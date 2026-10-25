//! Immutable packaged resources, separate from editable application data.
use sha2::{Digest, Sha256};
use std::{
    collections::BTreeMap,
    fs,
    path::{Path, PathBuf},
};

fn digest(bytes: &[u8]) -> String {
    format!("{:x}", Sha256::digest(bytes))
}

pub fn install(
    data_dir: &Path,
    manifest: &[u8],
    read: impl Fn(&str) -> Option<Vec<u8>>,
) -> Result<PathBuf, String> {
    let entries: BTreeMap<String, String> = serde_json::from_slice(manifest)
        .map_err(|error| format!("Invalid bundled resource manifest: {error}"))?;
    if entries.is_empty() {
        return Err("Empty bundled resource manifest".into());
    }
    let mut files = BTreeMap::new();
    for (name, expected) in &entries {
        if name.contains(['\\', ':']) || name.split('/').any(|part| matches!(part, "" | "." | ".."))
        {
            return Err(format!("Unsafe bundled resource path: {name}"));
        }
        let bytes = read(name).ok_or_else(|| format!("Missing bundled resource: {name}"))?;
        if digest(&bytes) != *expected {
            return Err(format!("Bundled resource checksum mismatch: {name}"));
        }
        files.insert(name, bytes);
    }
    let bundles = data_dir.join("bundles");
    if fs::symlink_metadata(&bundles).is_ok_and(|meta| meta.file_type().is_symlink()) {
        return Err("Resource bundle root must not be a symbolic link".into());
    }
    fs::create_dir_all(&bundles).map_err(|error| error.to_string())?;
    let destination = bundles.join(digest(manifest));
    let valid = || {
        let Ok(canonical_destination) = destination.canonicalize() else {
            return false;
        };
        !fs::symlink_metadata(&destination).is_ok_and(|meta| meta.file_type().is_symlink())
            && entries.iter().all(|(name, expected)| {
                let path = destination.join(name);
                path.canonicalize()
                    .is_ok_and(|p| p.starts_with(&canonical_destination))
                    && fs::read(path).is_ok_and(|bytes| digest(&bytes) == *expected)
            })
    };
    if valid() {
        return Ok(destination);
    }
    let nonce = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map_err(|error| error.to_string())?
        .as_nanos();
    let staging = bundles.join(format!(".stage-{}-{nonce}", std::process::id()));
    fs::create_dir(&staging).map_err(|error| error.to_string())?;
    for (name, bytes) in files {
        let path = staging.join(name);
        fs::create_dir_all(path.parent().unwrap()).map_err(|error| error.to_string())?;
        fs::write(&path, bytes).map_err(|error| error.to_string())?;
    }
    // Preserve a corrupt old bundle for diagnosis; never touch user config/data.
    if fs::symlink_metadata(&destination).is_ok() {
        fs::rename(&destination, bundles.join(format!(".corrupt-{nonce}")))
            .map_err(|error| error.to_string())?;
    }
    fs::rename(&staging, &destination).map_err(|error| error.to_string())?;
    Ok(destination)
}

#[cfg(target_os = "android")]
pub fn install_embedded(data_dir: &Path) -> Result<PathBuf, String> {
    #[derive(rust_embed::Embed)]
    #[folder = "fgaa-android-resources/"]
    struct Resources;
    let manifest = Resources::get("bundle.json").ok_or("Android resources were not staged")?;
    install(data_dir, &manifest.data, |name| {
        Resources::get(name).map(|file| file.data.into_owned())
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn installs_updates_and_repairs_without_changing_user_data() {
        let root = std::env::temp_dir().join(format!(
            "fgaa-bundle-{}-{}",
            std::process::id(),
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_nanos()
        ));
        fs::create_dir_all(root.join("config")).unwrap();
        fs::write(root.join("config/user.json"), b"keep me").unwrap();
        let manifest = |bytes: &[u8]| {
            serde_json::to_vec(&BTreeMap::from([
                ("interface.json", digest(bytes)),
                ("i18n/en.json", digest(b"{}")),
            ]))
            .unwrap()
        };
        let load = |name: &str| {
            Some(if name == "interface.json" {
                b"first".to_vec()
            } else {
                b"{}".to_vec()
            })
        };
        let first = install(&root, &manifest(b"first"), load).unwrap();
        assert_eq!(first, install(&root, &manifest(b"first"), load).unwrap());
        assert_eq!(fs::read_dir(root.join("bundles")).unwrap().count(), 1);
        fs::write(first.join("interface.json"), b"corrupt").unwrap();
        assert_eq!(first, install(&root, &manifest(b"first"), load).unwrap());
        assert_eq!(fs::read(first.join("interface.json")).unwrap(), b"first");
        let second = install(&root, &manifest(b"second"), |name| {
            Some(if name == "interface.json" {
                b"second".to_vec()
            } else {
                b"{}".to_vec()
            })
        })
        .unwrap();
        assert_ne!(first, second);
        assert_eq!(fs::read(root.join("config/user.json")).unwrap(), b"keep me");
        let unsafe_manifest =
            serde_json::to_vec(&BTreeMap::from([("../config/user.json", digest(b"bad"))])).unwrap();
        assert!(install(&root, &unsafe_manifest, |_| Some(b"bad".to_vec())).is_err());
        assert!(install(&root, &manifest(b"other"), load).is_err());
        assert_eq!(fs::read(root.join("config/user.json")).unwrap(), b"keep me");
        fs::remove_dir_all(root).unwrap();
    }
}
