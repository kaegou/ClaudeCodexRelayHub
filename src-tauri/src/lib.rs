mod commands;
mod config;
mod desktop_config;
mod health;
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
            let state = Arc::new(AppState::new(config));
            app.manage(state.clone());
            health::start(app.handle().clone(), state);
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::get_config,
            commands::save_app_config,
            commands::test_pool_member,
            commands::test_provider,
            commands::refresh_health,
            commands::start_codex_proxy,
            commands::stop_codex_proxy,
            commands::start_claude_proxy,
            commands::stop_claude_proxy,
            commands::proxy_status,
            commands::get_logs,
            commands::clear_logs,
            commands::write_codex_environment,
            commands::write_claude_gateway_config,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
