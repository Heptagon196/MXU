# Android host (work in progress)

Generated with the pinned Tauri CLI 2.9.6. This is the native project scaffold,
not a working Android release. Do not distribute an APK until the host and
runtime gates below pass.

- Initial `cargo check --target aarch64-linux-android --locked` with NDK
  28.2.13676358 reaches `openssl-sys`, which requires an Android OpenSSL build.
  Inspect the reqwest/native-tls feature chain before selecting the mobile TLS
  configuration.
- Desktop-only tray, global-shortcut and autostart initialization still needs
  platform gating. The existing desktop runtime cannot be assumed mobile-safe.
- Implement the skill editor's native landscape/immersive lifecycle and restore
  the previous orientation/system-bar state on exit. Browser Fullscreen and
  Screen Orientation mocks do not prove WebView behavior.
- Android app-data paths, Kotlin FGA runtime, Maa libraries and local control
  must be integrated and verified independently of Windows packaging.

Use `pnpm exec tauri android build` from the MXU root after setting JAVA_HOME,
ANDROID_HOME and NDK_HOME. Tauri generates the ignored per-machine Gradle
integration files; do not invoke plain Gradle before that generation step.
