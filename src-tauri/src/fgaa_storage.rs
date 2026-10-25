use std::{
    fs,
    io::Write,
    path::{Path, PathBuf},
    sync::Mutex,
};

static STORAGE_LOCK: Mutex<()> = Mutex::new(());
const MAX_SIZE: usize = 32 * 1024 * 1024;

fn storage_root() -> Result<PathBuf, String> {
    // Commands may arrive before setup has published the mobile directories.
    // Run only on the blocking pool: never call the Android path plugin here.
    #[cfg(mobile)]
    {
        let deadline = std::time::Instant::now() + std::time::Duration::from_secs(10);
        loop {
            match crate::commands::utils::get_app_data_dir() {
                Ok(root) => return Ok(root),
                Err(error) if std::time::Instant::now() >= deadline => return Err(error),
                Err(_) => std::thread::sleep(std::time::Duration::from_millis(25)),
            }
        }
    }
    #[cfg(desktop)]
    crate::commands::utils::get_app_data_dir()
}

fn path(root: &Path, key: &str) -> Result<PathBuf, String> {
    let name = match key {
        "library" => "battle-library.json",
        "globals" => "global-settings.json",
        _ => return Err("Unknown FGA document".into()),
    };
    Ok(root.join("data").join("fgaa").join(name))
}

fn validate(value: &str) -> Result<(), String> {
    if value.len() > MAX_SIZE {
        return Err("FGA document too large".into());
    }
    let json: serde_json::Value = serde_json::from_str(value).map_err(|e| e.to_string())?;
    if !json.is_object() || json.get("version").and_then(|v| v.as_u64()) != Some(1) {
        return Err("Unsupported FGA document version".into());
    }
    Ok(())
}

fn read(path: &Path) -> Result<Option<String>, String> {
    match fs::metadata(path) {
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => return Ok(None),
        Err(e) => return Err(e.to_string()),
        Ok(meta) if meta.len() > MAX_SIZE as u64 => return Err("FGA document too large".into()),
        Ok(_) => {}
    }
    let value = fs::read_to_string(path).map_err(|e| e.to_string())?;
    validate(&value)?;
    Ok(Some(value))
}

fn atomic_write(path: &Path, value: &str) -> Result<(), String> {
    let temporary = path.with_extension("tmp");
    let mut file = fs::File::create(&temporary).map_err(|e| e.to_string())?;
    file.write_all(value.as_bytes())
        .map_err(|e| e.to_string())?;
    file.sync_all().map_err(|e| e.to_string())?;
    drop(file);
    fs::rename(&temporary, path).map_err(|e| e.to_string())
}

fn save(root: &Path, key: &str, expected: Option<&str>, value: &str) -> Result<(), String> {
    validate(value)?;
    let target = path(root, key)?;
    let previous = read(&target)?;
    if previous.as_deref() != expected {
        return Err("FGA document changed on disk; reload before saving".into());
    }
    fs::create_dir_all(target.parent().unwrap()).map_err(|e| e.to_string())?;
    if let Some(previous) = previous {
        atomic_write(&target.with_extension("json.bak"), &previous)?;
    }
    atomic_write(&target, value)
}

#[tauri::command]
pub async fn fgaa_read_document(key: String) -> Result<Option<String>, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let root = storage_root()?;
        let _guard = STORAGE_LOCK.lock().map_err(|e| e.to_string())?;
        read(&path(&root, &key)?)
    })
    .await
    .map_err(|error| error.to_string())?
}

#[tauri::command]
pub async fn fgaa_save_document(
    key: String,
    expected: Option<String>,
    value: String,
) -> Result<(), String> {
    tauri::async_runtime::spawn_blocking(move || {
        let root = storage_root()?;
        let _guard = STORAGE_LOCK.lock().map_err(|e| e.to_string())?;
        save(&root, &key, expected.as_deref(), &value)
    })
    .await
    .map_err(|error| error.to_string())?
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn persistence_conflicts_backup_and_corruption() {
        let root = std::env::temp_dir().join(format!(
            "fgaa-storage-{}-{}",
            std::process::id(),
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_nanos()
        ));
        let target = path(&root, "library").unwrap();
        let first = r#"{"version":1,"entries":[]}"#;
        let next = r#"{"version":1,"entries":[{"id":"a","data":{}}]}"#;
        assert_eq!(read(&target).unwrap(), None);
        save(&root, "library", None, first).unwrap();
        assert!(save(&root, "library", None, next).is_err());
        assert_eq!(read(&target).unwrap().as_deref(), Some(first));
        save(&root, "library", Some(first), next).unwrap();
        assert_eq!(read(&target).unwrap().as_deref(), Some(next));
        assert_eq!(
            fs::read_to_string(target.with_extension("json.bak")).unwrap(),
            first
        );
        // A failed staging write must leave the committed document readable.
        fs::create_dir(target.with_extension("tmp")).unwrap();
        assert!(save(&root, "library", Some(next), first).is_err());
        assert_eq!(read(&target).unwrap().as_deref(), Some(next));
        fs::remove_dir(target.with_extension("tmp")).unwrap();
        fs::write(&target, "broken").unwrap();
        assert!(save(&root, "library", Some("broken"), first).is_err());
        assert_eq!(fs::read_to_string(&target).unwrap(), "broken");
        assert!(path(&root, "../other").is_err());
        assert!(save(&root, "globals", None, r#"{"version":2}"#).is_err());
        fs::remove_dir_all(root).unwrap();
    }
}
