use std::{process::Command, sync::Arc};

use anyhow::Result;
use tauri::{AppHandle, State};
use tokio::sync::oneshot;

use crate::{
    config, desktop_config,
    models::{AppConfig, CodexPoolMember, ProviderProfile, ProxyStatus, RequestLogEntry},
    provider_client,
    proxy::{claude, codex},
    state::AppState,
};

#[tauri::command]
pub async fn get_config(state: State<'_, Arc<AppState>>) -> Result<AppConfig, String> {
    Ok(state
        .config
        .lock()
        .map_err(|error| error.to_string())?
        .clone())
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
            let updated = if let Some(member) = config
                .codex_pool
                .members
                .iter_mut()
                .find(|member| member.id == member_id)
            {
                member.health = if error.to_string().contains("HTTP 401")
                    || error.to_string().contains("HTTP 403")
                {
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
    if let Some(member) = config
        .codex_pool
        .members
        .iter_mut()
        .find(|member| member.id == member_id)
    {
        *member = checked.clone();
    }
    config::save_config(&app, &config).map_err(|error| error.to_string())?;
    Ok(checked)
}

#[tauri::command]
pub async fn test_provider(
    app: AppHandle,
    state: State<'_, Arc<AppState>>,
    provider_id: String,
) -> Result<ProviderProfile, String> {
    let provider = {
        let config = state.config.lock().map_err(|error| error.to_string())?;
        config
            .providers
            .iter()
            .find(|provider| provider.id == provider_id)
            .cloned()
            .ok_or_else(|| "provider not found".to_string())?
    };

    let checked = match provider_client::test_provider(&state.http, provider).await {
        Ok(provider) => provider,
        Err(error) => {
            let mut config = state.config.lock().map_err(|error| error.to_string())?;
            let updated = if let Some(provider) = config
                .providers
                .iter_mut()
                .find(|provider| provider.id == provider_id)
            {
                provider.health = if error.to_string().contains("HTTP 401")
                    || error.to_string().contains("HTTP 403")
                {
                    "auth_error".to_string()
                } else if error.to_string().contains("HTTP 429") {
                    "rate_limited".to_string()
                } else {
                    "server_error".to_string()
                };
                provider.last_error = Some(error.to_string());
                Some(provider.clone())
            } else {
                None
            };

            if let Some(provider) = updated {
                config::save_config(&app, &config).map_err(|error| error.to_string())?;
                return Ok(provider);
            }

            return Err(error.to_string());
        }
    };

    let mut config = state.config.lock().map_err(|error| error.to_string())?;
    if let Some(provider) = config
        .providers
        .iter_mut()
        .find(|provider| provider.id == provider_id)
    {
        *provider = checked.clone();
    }
    config::save_config(&app, &config).map_err(|error| error.to_string())?;
    Ok(checked)
}

#[tauri::command]
pub async fn start_codex_proxy(state: State<'_, Arc<AppState>>) -> Result<(), String> {
    let mut shutdown_slot = state
        .codex_shutdown
        .lock()
        .map_err(|error| error.to_string())?;
    if shutdown_slot.is_some() {
        return Ok(());
    }

    let port = state
        .config
        .lock()
        .map_err(|error| error.to_string())?
        .codex_proxy_port;
    let (tx, rx) = oneshot::channel();
    *shutdown_slot = Some(tx);
    let app_state = state.inner().clone();
    state
        .logs
        .info("codex", format!("Starting Codex proxy on 127.0.0.1:{port}"));

    tauri::async_runtime::spawn(async move {
        if let Err(error) = codex::serve_codex(app_state.clone(), port, rx).await {
            app_state
                .logs
                .info("codex", format!("Codex proxy stopped: {error}"));
        }
    });

    Ok(())
}

#[tauri::command]
pub async fn stop_codex_proxy(state: State<'_, Arc<AppState>>) -> Result<(), String> {
    if let Some(tx) = state
        .codex_shutdown
        .lock()
        .map_err(|error| error.to_string())?
        .take()
    {
        let _ = tx.send(());
    }
    state.logs.info("codex", "Codex proxy stop requested");
    Ok(())
}

#[tauri::command]
pub async fn start_claude_proxy(state: State<'_, Arc<AppState>>) -> Result<(), String> {
    let mut shutdown_slot = state
        .claude_shutdown
        .lock()
        .map_err(|error| error.to_string())?;
    if shutdown_slot.is_some() {
        return Ok(());
    }

    let port = state
        .config
        .lock()
        .map_err(|error| error.to_string())?
        .claude_proxy_port;
    let (tx, rx) = oneshot::channel();
    *shutdown_slot = Some(tx);
    let app_state = state.inner().clone();
    state.logs.info(
        "claude",
        format!("Starting Claude proxy on 127.0.0.1:{port}"),
    );

    tauri::async_runtime::spawn(async move {
        if let Err(error) = claude::serve_claude(app_state.clone(), port, rx).await {
            app_state
                .logs
                .info("claude", format!("Claude proxy stopped: {error}"));
        }
    });

    Ok(())
}

#[tauri::command]
pub async fn stop_claude_proxy(state: State<'_, Arc<AppState>>) -> Result<(), String> {
    if let Some(tx) = state
        .claude_shutdown
        .lock()
        .map_err(|error| error.to_string())?
        .take()
    {
        let _ = tx.send(());
    }
    state.logs.info("claude", "Claude proxy stop requested");
    Ok(())
}

#[tauri::command]
pub async fn proxy_status(state: State<'_, Arc<AppState>>) -> Result<ProxyStatus, String> {
    let config = state.config.lock().map_err(|error| error.to_string())?;
    Ok(ProxyStatus {
        codex_running: state
            .codex_shutdown
            .lock()
            .map_err(|error| error.to_string())?
            .is_some(),
        claude_running: state
            .claude_shutdown
            .lock()
            .map_err(|error| error.to_string())?
            .is_some(),
        codex_port: config.codex_proxy_port,
        claude_port: config.claude_proxy_port,
        last_codex_member_id: state
            .last_codex_member_id
            .lock()
            .map_err(|error| error.to_string())?
            .clone(),
    })
}

#[tauri::command]
pub async fn get_logs(state: State<'_, Arc<AppState>>) -> Result<Vec<RequestLogEntry>, String> {
    Ok(state.logs.list())
}

#[tauri::command]
pub async fn write_codex_environment(state: State<'_, Arc<AppState>>) -> Result<String, String> {
    let config = state
        .config
        .lock()
        .map_err(|error| error.to_string())?
        .clone();
    let base_url = format!("http://127.0.0.1:{}/v1", config.codex_proxy_port);

    set_user_env("OPENAI_BASE_URL", &base_url)?;
    set_user_env("OPENAI_API_KEY", &config.local_proxy_token)?;
    set_user_env("CODEX_RELAY_BASE_URL", &base_url)?;
    set_user_env("CODEX_RELAY_API_KEY", &config.local_proxy_token)?;

    state
        .logs
        .info("codex", format!("Wrote Codex environment for {base_url}"));
    Ok(format!(
        "Codex environment variables written for {base_url}"
    ))
}

#[tauri::command]
pub async fn write_claude_gateway_config(
    app: AppHandle,
    state: State<'_, Arc<AppState>>,
) -> Result<String, String> {
    let config = state
        .config
        .lock()
        .map_err(|error| error.to_string())?
        .clone();
    let path = desktop_config::write_claude_desktop_gateway(&app, &config)
        .map_err(|error| error.to_string())?;
    state.logs.info(
        "claude",
        format!("Wrote Claude Desktop Gateway config to {}", path.display()),
    );
    Ok(path.display().to_string())
}

#[cfg(target_os = "windows")]
fn set_user_env(name: &str, value: &str) -> Result<(), String> {
    let status = Command::new("reg")
        .args([
            "add",
            "HKCU\\Environment",
            "/v",
            name,
            "/t",
            "REG_SZ",
            "/d",
            value,
            "/f",
        ])
        .status()
        .map_err(|error| error.to_string())?;

    if !status.success() {
        return Err(format!("failed to write user environment variable {name}"));
    }

    std::env::set_var(name, value);
    Ok(())
}

#[cfg(not(target_os = "windows"))]
fn set_user_env(_name: &str, _value: &str) -> Result<(), String> {
    Err("writing persistent user environment variables is only implemented on Windows".to_string())
}
