# Android host (work in progress)

Generated with the pinned Tauri CLI 2.9.6. This is the native project scaffold,
not a working Android release. Do not distribute an APK until the host and
runtime gates below pass.

- ARM64 Rust cross-check passes with NDK 28.2.13676358. Android uses Rustls;
  desktop retains its TLS features. Tray, shortcuts, autostart and machine-uid
  dependencies are isolated to desktop. Unsupported tray writes return errors.
- The native skill-display plugin requests sensor landscape and immersive
  system bars, records the previous state, and restores it on exit. Releases
  carry a generation token so an old editor cannot release a new editor's state.
  Actual Activity/WebView behavior still requires device verification.
- Android data and logs use private application directories. The Kotlin FGA
  runtime, Maa libraries, bundled PI resources and local control still need
  integration. A successful APK build alone does not enable automation.

Use `pnpm exec tauri android build` from the MXU root after setting JAVA_HOME,
ANDROID_HOME and NDK_HOME. Tauri generates the ignored per-machine Gradle
integration files; do not invoke plain Gradle before that generation step.

The FGAA root also provides `tools/check-mxu-android.ps1` and
`tools/build-mxu-android.ps1`. The latter handles Windows machines without
symbolic-link privileges by copying Tauri's successfully built ARM64 library
and skipping only that Rust task during Gradle packaging. Neither script
installs the APK or accesses a device.
