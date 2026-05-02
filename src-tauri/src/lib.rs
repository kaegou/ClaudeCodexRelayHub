mod commands;
mod config;
mod logging;
mod models;
mod pool;
mod provider_client;
mod proxy;
mod state;

use std::sync::Arc;

use state::AppState;
use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .setup(|app| {
            let config = config::load_config(app.handle())?;
            app.manage(Arc::new(AppState::new(config)));
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::get_config,
            commands::save_app_config,
            commands::test_pool_member,
            commands::start_codex_proxy,
            commands::stop_codex_proxy,
            commands::start_claude_proxy,
            commands::stop_claude_proxy,
            commands::proxy_status,
            commands::get_logs,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
