//! 托盘相关命令

#[cfg(desktop)]
use crate::tray;

/// 设置关闭时是否最小化到托盘
#[tauri::command]
pub fn set_minimize_to_tray(enabled: bool) -> Result<(), String> {
    #[cfg(desktop)]
    {
        tray::set_minimize_to_tray(enabled);
        log::info!("Minimize to tray: {}", enabled);
        Ok(())
    }
    #[cfg(mobile)]
    {
        let _ = enabled;
        Err("System tray is unavailable on mobile".into())
    }
}

/// 获取关闭时是否最小化到托盘的设置
#[tauri::command]
pub fn get_minimize_to_tray() -> bool {
    #[cfg(desktop)]
    {
        tray::get_minimize_to_tray()
    }
    #[cfg(mobile)]
    {
        false
    }
}

/// 更新托盘图标
#[tauri::command]
pub fn update_tray_icon(icon_path: String) -> Result<(), String> {
    #[cfg(desktop)]
    {
        tray::update_tray_icon(&icon_path)
    }
    #[cfg(mobile)]
    {
        let _ = icon_path;
        Err("System tray is unavailable on mobile".into())
    }
}

/// 更新托盘 tooltip
#[tauri::command]
pub fn update_tray_tooltip(tooltip: String) -> Result<(), String> {
    #[cfg(desktop)]
    {
        tray::update_tray_tooltip(&tooltip)
    }
    #[cfg(mobile)]
    {
        let _ = tooltip;
        Err("System tray is unavailable on mobile".into())
    }
}
