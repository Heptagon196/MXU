#[cfg(target_os = "android")]
use tauri::Manager;

#[cfg(target_os = "android")]
pub fn init() -> tauri::plugin::TauriPlugin<tauri::Wry> {
    tauri::plugin::Builder::new("fgaa-display")
        .js_init_script("Object.defineProperty(window, '__FGAA_ANDROID__', { value: true });")
        .setup(|app, api| {
            let handle = api.register_android_plugin("com.misteo.mxu", "SkillDisplayPlugin")?;
            app.manage(DisplayPlugin(handle));
            Ok(())
        })
        .build()
}

#[cfg(target_os = "android")]
struct DisplayPlugin(tauri::plugin::PluginHandle<tauri::Wry>);

#[tauri::command]
pub async fn fgaa_enter_skill_display(app: tauri::AppHandle) -> Result<Option<u32>, String> {
    #[cfg(target_os = "android")]
    {
        #[derive(serde::Deserialize)]
        struct Lease {
            token: u32,
        }
        let lease: Lease = app
            .state::<DisplayPlugin>()
            .0
            .run_mobile_plugin_async("enter", serde_json::json!({}))
            .await
            .map_err(|error| error.to_string())?;
        Ok(Some(lease.token))
    }
    #[cfg(not(target_os = "android"))]
    {
        let _ = app;
        Ok(None)
    }
}

#[tauri::command]
pub async fn fgaa_leave_skill_display(app: tauri::AppHandle, token: u32) -> Result<(), String> {
    #[cfg(target_os = "android")]
    {
        app.state::<DisplayPlugin>()
            .0
            .run_mobile_plugin_async("leave", serde_json::json!({ "token": token }))
            .await
            .map_err(|error| error.to_string())
    }
    #[cfg(not(target_os = "android"))]
    {
        let _ = (app, token);
        Ok(())
    }
}
