use std::sync::Arc;

use anyhow::Result;
use tauri::{AppHandle, State};
use tokio::sync::oneshot;

use crate::{
    config,
    models::{AppConfig, CodexPoolMember, ProxyStatus, RequestLogEntry},
    provider_client,
    proxy::{claude, codex},
    state::AppState,
};

#[tauri::command]
pub async fn get_config(state: State<'_, Arc<AppState>>) -> Result<AppConfig, String> {
    Ok(state.config.lock().map_err(|error| error.to_string())?.clone())
}

#[tauri::command]
pub async fn save_app_config(
    app: AppHandle,
    state: State<'_, Arc<AppState>>,
    mut next_config: AppConfig,
) -> Result<AppConfig, String> {
    next_config.ensure_defaults();
    config::save_config(&app, &next_config).map_err(|error| error.to_string())?;
    *state.config.lock().map_err(|error| error.to_string())? = next_config.clone();
    Ok(next_config)
}

#[tauri::command]
pub async fn test_pool_member(
    app: AppHandle,
    state: State<'_, Arc<AppState>>,
    member_id: String,
) -> Result<CodexPoolMember, String> {
    let member = {
        let config = state.config.lock().map_err(|error| error.to_string())?;
        config
            .codex_pool
            .members
            .iter()
            .find(|member| member.id == member_id)
            .cloned()
            .ok_or_else(|| "pool member not found".to_string())?
    };

    let checked = match provider_client::test_member(&state.http, member).await {
        Ok(member) => member,
        Err(error) => {
            let mut config = state.config.lock().map_err(|error| error.to_string())?;
            let updated = if let Some(member) = config.codex_pool.members.iter_mut().find(|member| member.id == member_id) {
                member.health = if error.to_string().contains("HTTP 401") || error.to_string().contains("HTTP 403") {
                    "auth_error".to_string()
                } else if error.to_string().contains("HTTP 429") {
                    "rate_limited".to_string()
                } else {
                    "server_error".to_string()
                };
                member.last_error = Some(error.to_string());
                Some(member.clone())
            } else {
                None
            };

            if let Some(member) = updated {
                config::save_config(&app, &config).map_err(|error| error.to_string())?;
                return Ok(member);
            }

            return Err(error.to_string());
        }
    };

    let mut config = state.config.lock().map_err(|error| error.to_string())?;
    if let Some(member) = config.codex_pool.members.iter_mut().find(|member| member.id == member_id) {
        *member = checked.clone();
    }
    config::save_config(&app, &config).map_err(|error| error.to_string())?;
    Ok(checked)
}

#[tauri::command]
pub async fn start_codex_proxy(state: State<'_, Arc<AppState>>) -> Result<(), String> {
    let mut shutdown_slot = state.codex_shutdown.lock().map_err(|error| error.to_string())?;
    if shutdown_slot.is_some() {
        return Ok(());
    }

    let port = state.config.lock().map_err(|error| error.to_string())?.codex_proxy_port;
    let (tx, rx) = oneshot::channel();
    *shutdown_slot = Some(tx);
    let app_state = state.inner().clone();
    state.logs.info("codex", format!("Starting Codex proxy on 127.0.0.1:{port}"));

    tauri::async_runtime::spawn(async move {
        if let Err(error) = codex::serve_codex(app_state.clone(), port, rx).await {
            app_state.logs.info("codex", format!("Codex proxy stopped: {error}"));
        }
    });

    Ok(())
}

#[tauri::command]
pub async fn stop_codex_proxy(state: State<'_, Arc<AppState>>) -> Result<(), String> {
    if let Some(tx) = state.codex_shutdown.lock().map_err(|error| error.to_string())?.take() {
        let _ = tx.send(());
    }
    state.logs.info("codex", "Codex proxy stop requested");
    Ok(())
}

#[tauri::command]
pub async fn start_claude_proxy(state: State<'_, Arc<AppState>>) -> Result<(), String> {
    let mut shutdown_slot = state.claude_shutdown.lock().map_err(|error| error.to_string())?;
    if shutdown_slot.is_some() {
        return Ok(());
    }

    let port = state.config.lock().map_err(|error| error.to_string())?.claude_proxy_port;
    let (tx, rx) = oneshot::channel();
    *shutdown_slot = Some(tx);
    let app_state = state.inner().clone();
    state.logs.info("claude", format!("Starting Claude proxy on 127.0.0.1:{port}"));

    tauri::async_runtime::spawn(async move {
        if let Err(error) = claude::serve_claude(app_state.clone(), port, rx).await {
            app_state.logs.info("claude", format!("Claude proxy stopped: {error}"));
        }
    });

    Ok(())
}

#[tauri::command]
pub async fn stop_claude_proxy(state: State<'_, Arc<AppState>>) -> Result<(), String> {
    if let Some(tx) = state.claude_shutdown.lock().map_err(|error| error.to_string())?.take() {
        let _ = tx.send(());
    }
    state.logs.info("claude", "Claude proxy stop requested");
    Ok(())
}

#[tauri::command]
pub async fn proxy_status(state: State<'_, Arc<AppState>>) -> Result<ProxyStatus, String> {
    let config = state.config.lock().map_err(|error| error.to_string())?;
    Ok(ProxyStatus {
        codex_running: state.codex_shutdown.lock().map_err(|error| error.to_string())?.is_some(),
        claude_running: state.claude_shutdown.lock().map_err(|error| error.to_string())?.is_some(),
        codex_port: config.codex_proxy_port,
        claude_port: config.claude_proxy_port,
        last_codex_member_id: state.last_codex_member_id.lock().map_err(|error| error.to_string())?.clone(),
    })
}

#[tauri::command]
pub async fn get_logs(state: State<'_, Arc<AppState>>) -> Result<Vec<RequestLogEntry>, String> {
    Ok(state.logs.list())
}
