//! 辅助函数
//!
//! 提供路径处理和其他通用工具函数

use super::types::{MaaCallbackEvent, MaaState, StateChangedEvent};
use crate::ws_broadcast::{WsBroadcast, WsEvent};
use std::path::PathBuf;
use std::sync::Arc;
use tauri::{AppHandle, Emitter, Manager};

#[cfg(mobile)]
static MOBILE_DATA_DIR: std::sync::OnceLock<PathBuf> = std::sync::OnceLock::new();
#[cfg(mobile)]
static MOBILE_RESOURCE_DIR: std::sync::OnceLock<PathBuf> = std::sync::OnceLock::new();

#[cfg(mobile)]
pub fn init_mobile_paths(app: &AppHandle) -> Result<(), String> {
    let path = app.path().app_data_dir().map_err(|error| error.to_string())?;
    std::fs::create_dir_all(&path).map_err(|error| error.to_string())?;
    #[cfg(target_os = "android")]
    let resources = crate::fgaa_bundle::install_embedded(&path)?;
    #[cfg(not(target_os = "android"))]
    let resources = path.clone();
    MOBILE_RESOURCE_DIR
        .set(resources)
        .map_err(|_| "Mobile resources already initialized".to_string())?;
    MOBILE_DATA_DIR
        .set(path)
        .map_err(|_| "Mobile paths already initialized".to_string())
}

/// 发送回调事件到前端（Tauri WebView + WebSocket 浏览器客户端）
pub fn emit_callback_event<S: Into<String>>(app: &AppHandle, message: S, details: S) {
    let message = message.into();
    let details = details.into();

    // 广播到所有 WebSocket 客户端
    if let Some(ws) = app.try_state::<Arc<WsBroadcast>>() {
        ws.send(WsEvent::MaaCallback {
            message: message.clone(),
            details: details.clone(),
        });
    }

    // 发送到 Tauri WebView
    let event = MaaCallbackEvent { message, details };
    if let Err(e) = app.emit("maa-callback", event) {
        log::error!("Failed to emit maa-callback: {}", e);
    }
}

/// 发送实例状态变更事件（双通道：WS 浏览器客户端 + Tauri WebView）
///
/// Tauri 端和 WebUI 端都会收到此事件，用于刷新 `isRunning`、连接状态等运行时信息。
pub fn emit_state_changed(app: &AppHandle, instance_id: &str, kind: &str) {
    // 广播到所有 WebSocket 客户端
    if let Some(ws) = app.try_state::<Arc<WsBroadcast>>() {
        ws.send(WsEvent::StateChanged {
            instance_id: instance_id.to_string(),
            kind: kind.to_string(),
        });
    }

    // 发送到 Tauri WebView
    let event = StateChangedEvent {
        instance_id: instance_id.to_string(),
        kind: kind.to_string(),
    };
    if let Err(e) = app.emit("state-changed", event) {
        log::error!("Failed to emit state-changed: {}", e);
    }
}

/// 处理 MaaFramework 任务回调，在 Rust 侧更新 TaskRunState（单一真相来源）
///
/// 应在 tasker sink 中调用，在 `emit_callback_event` 之前处理任务状态变更。
/// 负责跟踪 Tasker.Task.Starting / Succeeded / Failed，并在所有任务完成后
/// 更新 `overall_status` 并发射 `tasks-completed` 事件。
pub fn handle_task_callback(
    maa_state: &Arc<MaaState>,
    app: &AppHandle,
    instance_id: &str,
    message: &str,
    details: &str,
) {
    let is_started = message == "Tasker.Task.Starting";
    let mut is_succeeded = message == "Tasker.Task.Succeeded";
    let is_failed = message == "Tasker.Task.Failed";

    if !is_started && !is_succeeded && !is_failed {
        return;
    }

    let parsed = serde_json::from_str::<serde_json::Value>(details).ok();
    let task_id: i64 = match parsed.as_ref().and_then(|v| v["task_id"].as_i64()) {
        Some(id) => id,
        None => return,
    };

    if !is_started
        && parsed
            .as_ref()
            .and_then(|v| v["entry"].as_str())
            .is_some_and(crate::fgaa_queue::is_fgaa_entry)
    {
        // Maa reports a stopped Pipeline as Succeeded. Require positive action
        // evidence before considering a FGA task successful.
        let completed = {
            let instances = match maa_state.instances.lock() {
                Ok(instances) => instances,
                Err(_) => return,
            };
            instances
                .get(instance_id)
                .and_then(|instance| instance.tasker.as_ref())
                .and_then(|tasker| tasker.get_task_detail(task_id).ok().flatten())
                .is_some_and(|detail| crate::fgaa_queue::completed(&detail))
        };
        if is_failed || !completed {
            is_succeeded = false;
            if stop_fgaa_queue(maa_state, app, instance_id, task_id) {
                return;
            }
        }
    }

    let all_done = {
        let mut instances = match maa_state.instances.lock() {
            Ok(g) => g,
            Err(_) => return,
        };
        let instance = match instances.get_mut(instance_id) {
            Some(i) => i,
            None => return,
        };
        let state = &mut instance.task_run_state;
        if state.fgaa_cancelled_ids.contains(&task_id) {
            return;
        }

        if is_started {
            // 任务开始：定位该任务在队列中的索引，更新当前索引和状态
            if let Some(idx) = state.pending_task_ids.iter().position(|&id| id == task_id) {
                state.current_task_index = idx;
            }
            if let Some(selected_id) = state.mappings.get(&task_id).cloned() {
                state.statuses.insert(selected_id, "running".to_string());
            }
            false // 未完成
        } else {
            // 任务成功或失败
            let status_str = if is_succeeded { "succeeded" } else { "failed" };
            if let Some(selected_id) = state.mappings.get(&task_id).cloned() {
                state.statuses.insert(selected_id, status_str.to_string());
            }

            // 检查所有已入队任务是否均已完成
            let all_completed = state.pending_task_ids.iter().all(|id| {
                state
                    .mappings
                    .get(id)
                    .and_then(|sel_id| state.statuses.get(sel_id))
                    .map(|s| s == "succeeded" || s == "failed")
                    .unwrap_or(false)
            });

            if all_completed {
                let has_failed = state.statuses.values().any(|s| s == "failed");
                state.overall_status =
                    Some(if has_failed { "Failed" } else { "Succeeded" }.to_string());
                instance.task_ids.clear();
            }

            all_completed
        }
    }; // 锁在此处释放

    // 遥测埋点（锁外调用，仅操作 telemetry 内部的 RUNS 锁）
    if is_started {
        super::telemetry::on_task_start(instance_id, task_id);
    } else {
        super::telemetry::on_task_finished(instance_id, task_id, is_succeeded);
    }
    if all_done {
        super::telemetry::on_run_finished(instance_id);
    }

    // 通知前端刷新状态
    emit_state_changed(app, instance_id, "task-progress");
    if all_done {
        emit_state_changed(app, instance_id, "tasks-completed");

        // 实例内全部任务结束后清理旧 agent，避免 agent 进程跨轮累积
        if let Err(e) = super::maa_agent::stop_agent_impl(maa_state, instance_id) {
            log::warn!(
                "[handle_task_callback] Failed to stop agents after tasks completed: {}",
                e
            );
        }
    }
}

/// Stop only a currently tracked FGA run. Late child EOF cannot stop its replacement.
pub(crate) fn stop_fgaa_queue(
    maa_state: &Arc<MaaState>,
    app: &AppHandle,
    instance_id: &str,
    task_id: i64,
) -> bool {
    {
        let Ok(mut instances) = maa_state.instances.lock() else {
            return false;
        };
        let Some(instance) = instances.get_mut(instance_id) else {
            return false;
        };
        if !crate::fgaa_queue::is_active(&instance.task_run_state, task_id) {
            return false;
        }
        let Some(tasker) = instance.tasker.as_ref() else {
            return false;
        };
        if let Err(error) = tasker.post_stop() {
            log::error!("Could not stop interrupted FGA queue: {}", error);
            return false;
        }
        crate::fgaa_queue::abort(&mut instance.task_run_state, task_id);
        instance.task_ids.clear();
    }
    super::telemetry::on_task_finished(instance_id, task_id, false);
    super::telemetry::on_run_finished(instance_id);
    emit_state_changed(app, instance_id, "task-progress");
    emit_state_changed(app, instance_id, "tasks-completed");
    if let Err(error) = super::maa_agent::stop_agent_impl(maa_state, instance_id) {
        log::warn!("Could not clean up interrupted FGA agent: {}", error);
    }
    true
}

/// 发送配置变更事件（双通道：WS 浏览器客户端 + Tauri WebView）
///
/// 各客户端收到后应重新拉取配置并 `importConfig`（需配合 `consumeSelfSave` 跳过自身触发）。
pub fn emit_config_changed(app: &AppHandle) {
    // 广播到所有 WebSocket 客户端
    if let Some(ws) = app.try_state::<Arc<WsBroadcast>>() {
        ws.send(WsEvent::ConfigChanged);
    }

    // 发送到 Tauri WebView
    if let Err(e) = app.emit("config-changed-external", ()) {
        log::error!("Failed to emit config-changed-external: {}", e);
    }
}

/// 获取应用数据目录
/// - macOS: ~/Library/Application Support/MXU/
/// - Windows/Linux: exe 所在目录（保持便携式部署）
pub fn get_app_data_dir() -> Result<PathBuf, String> {
    #[cfg(mobile)]
    {
        MOBILE_DATA_DIR.get().cloned().ok_or_else(|| "Mobile paths not initialized".into())
    }
    #[cfg(target_os = "macos")]
    {
        let home = std::env::var("HOME").map_err(|_| "无法获取 HOME 环境变量".to_string())?;
        let path = PathBuf::from(home)
            .join("Library")
            .join("Application Support")
            .join("MXU");
        Ok(path)
    }

    #[cfg(all(desktop, not(target_os = "macos")))]
    {
        // Windows/Linux 保持便携式，使用 exe 所在目录
        get_exe_directory()
    }
}

/// 规范化路径：移除冗余的 `.`、处理 `..`、统一分隔符
/// 使用 Path::components() 解析，不需要路径实际存在
pub fn normalize_path(path: &str) -> PathBuf {
    use std::path::{Component, Path};

    let path = Path::new(path);
    let mut components = Vec::new();

    for component in path.components() {
        match component {
            // 跳过当前目录标记 "."
            Component::CurDir => {}
            // 处理父目录 ".."：如果栈顶是普通目录则弹出，否则保留
            Component::ParentDir => {
                if matches!(components.last(), Some(Component::Normal(_))) {
                    components.pop();
                } else {
                    components.push(component);
                }
            }
            // 保留其他组件（Prefix、RootDir、Normal）
            _ => components.push(component),
        }
    }

    // 重建路径
    components.into_iter().collect()
}

/// 获取日志目录（应用数据目录下的 debug 子目录）
pub fn get_logs_dir() -> PathBuf {
    get_app_data_dir()
        .unwrap_or_else(|_| {
            // 回退到 exe 目录
            let exe_path = std::env::current_exe().unwrap_or_default();
            exe_path
                .parent()
                .unwrap_or(std::path::Path::new("."))
                .to_path_buf()
        })
        .join("debug")
}

/// 获取 exe 所在目录路径（内部使用）
pub fn get_exe_directory() -> Result<PathBuf, String> {
    #[cfg(mobile)]
    {
        // Android current_exe points at app_process, not a writable app folder.
        MOBILE_RESOURCE_DIR
            .get()
            .cloned()
            .ok_or_else(|| "Mobile paths not initialized".into())
    }
    #[cfg(desktop)]
    {
        let exe_path = std::env::current_exe().map_err(|e| format!("获取 exe 路径失败: {}", e))?;
        exe_path
            .parent()
            .map(|p| p.to_path_buf())
            .ok_or_else(|| "无法获取 exe 所在目录".to_string())
    }
}

/// 获取可执行文件所在目录下的 maafw 子目录
pub fn get_maafw_dir() -> Result<PathBuf, String> {
    Ok(get_exe_directory()?.join("maafw"))
}

/// 构建 User-Agent 字符串
pub fn build_user_agent() -> String {
    let version = env!("CARGO_PKG_VERSION");
    let os = std::env::consts::OS;
    let arch = std::env::consts::ARCH;
    let tauri_version = tauri::VERSION;
    format!("MXU/{} ({}; {}) Tauri/{}", version, os, arch, tauri_version)
}

/// 构建启动程序的 Command
///
/// - 子进程的 stdout/stderr 设为 null，避免继承父进程的标准流。
/// - 当 `use_cmd` 为 true 时（仅 Windows），通过 `cmd /c` 启动并设置
///   `CREATE_NO_WINDOW` 标志隐藏控制台窗口。
///
/// 注意：曾经使用 `CREATE_BREAKAWAY_FROM_JOB` 使子进程脱离父进程 Job 对象，
/// 但 Windows 计划任务创建的 Job 默认不允许 breakaway（未设置
/// `JOB_OBJECT_LIMIT_BREAKAWAY_OK`），导致 `CreateProcessW` 返回
/// `ERROR_ACCESS_DENIED (os error 5)`。
///
/// 手动启动 MXU 时，MXU 不在任何 Job Object 中，该标志没有 Job 可脱离，
/// 被 Windows 静默忽略，因此不会报错——但这只是巧合，不代表该标志真正生效。
/// 计划任务启动时，MXU 被关在限制性 Job 中，该标志才真正触发错误。
///
/// `cmd /c` 本身已改变了 PPID 链，进程树隔离目的已达成，因此移除该标志。
pub fn build_launch_command(
    program: &str,
    args: &[String],
    use_cmd: bool,
) -> std::process::Command {
    use std::process::Stdio;

    let mut cmd = if cfg!(target_os = "windows") && use_cmd {
        let mut c = std::process::Command::new("cmd.exe");
        c.arg("/c").arg(program);
        if !args.is_empty() {
            c.args(args);
        }
        c
    } else {
        let mut c = std::process::Command::new(program);
        if !args.is_empty() {
            c.args(args);
        }
        c
    };

    // 不继承父进程的标准流
    cmd.stdout(Stdio::null()).stderr(Stdio::null());

    #[cfg(target_os = "windows")]
    if use_cmd {
        use std::os::windows::process::CommandExt;
        const CREATE_NO_WINDOW: u32 = 0x0800_0000;
        cmd.creation_flags(CREATE_NO_WINDOW);
    }

    cmd
}
