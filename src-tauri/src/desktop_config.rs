use std::{fs, path::PathBuf};

use anyhow::{Context, Result};
use chrono::Local;
use serde_json::json;
use tauri::{AppHandle, Manager};

use crate::models::AppConfig;

pub fn write_claude_desktop_gateway(app: &AppHandle, config: &AppConfig) -> Result<PathBuf> {
    let path = claude_desktop_config_path(app)?;
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)
            .with_context(|| format!("failed to create {}", parent.display()))?;
    }

    if path.exists() {
        let stamp = Local::now().format("%Y%m%d-%H%M%S");
        let backup = path.with_file_name(format!("claude_desktop_config.{stamp}.backup.json"));
        fs::copy(&path, &backup).with_context(|| format!("failed to backup {}", path.display()))?;
    }

    let provider = config
        .providers
        .iter()
        .find(|provider| provider.id == config.active_claude_provider_id)
        .or_else(|| config.providers.first());

    let models = provider
        .map(|provider| provider.models.clone())
        .unwrap_or_else(|| vec!["gpt-5.5".to_string(), "gpt-5.4".to_string()]);

    let gateway = json!({
        "inferenceProvider": "gateway",
        "inferenceGatewayBaseUrl": format!("http://127.0.0.1:{}", config.claude_proxy_port),
        "inferenceGatewayApiKey": config.local_proxy_token,
        "inferenceGatewayAuthScheme": "bearer",
        "inferenceModels": models
    });

    let tmp = path.with_extension("json.tmp");
    fs::write(&tmp, serde_json::to_string_pretty(&gateway)?)
        .with_context(|| format!("failed to write {}", tmp.display()))?;
    fs::rename(&tmp, &path).with_context(|| format!("failed to replace {}", path.display()))?;
    Ok(path)
}

fn claude_desktop_config_path(app: &AppHandle) -> Result<PathBuf> {
    if let Ok(appdata) = std::env::var("APPDATA") {
        return Ok(PathBuf::from(appdata)
            .join("Claude")
            .join("claude_desktop_config.json"));
    }

    Ok(app
        .path()
        .app_config_dir()
        .context("failed to resolve app config directory")?
        .join("claude_desktop_config.json"))
}
