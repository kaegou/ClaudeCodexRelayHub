use std::{fs, path::PathBuf};

use anyhow::{Context, Result};
use tauri::{AppHandle, Manager};

use crate::models::{AppConfig, CodexPool, CodexPoolMember, ProviderProfile};

pub fn config_dir(app: &AppHandle) -> Result<PathBuf> {
    let dir = app
        .path()
        .app_config_dir()
        .context("failed to resolve app config directory")?;
    fs::create_dir_all(&dir).with_context(|| format!("failed to create {}", dir.display()))?;
    Ok(dir)
}

pub fn config_path(app: &AppHandle) -> Result<PathBuf> {
    Ok(config_dir(app)?.join("config.json"))
}

pub fn load_config(app: &AppHandle) -> Result<AppConfig> {
    let path = config_path(app)?;
    if !path.exists() {
        let config = AppConfig::default();
        save_config(app, &config)?;
        return Ok(config);
    }

    let content = fs::read_to_string(&path).with_context(|| format!("failed to read {}", path.display()))?;
    let mut config: AppConfig = serde_json::from_str(&content).with_context(|| format!("invalid config json at {}", path.display()))?;
    config.ensure_defaults();
    Ok(config)
}

pub fn save_config(app: &AppHandle, config: &AppConfig) -> Result<()> {
    let path = config_path(app)?;
    let tmp = path.with_extension("json.tmp");
    let content = serde_json::to_string_pretty(config)?;
    fs::write(&tmp, content).with_context(|| format!("failed to write {}", tmp.display()))?;
    fs::rename(&tmp, &path).with_context(|| format!("failed to replace {}", path.display()))?;
    Ok(())
}

pub fn longxia_claude_provider() -> ProviderProfile {
    ProviderProfile {
        id: "longxia-claude".to_string(),
        name: "Longxia Claude".to_string(),
        target: "claude".to_string(),
        protocol: "openai-compatible".to_string(),
        api_base: "https://api.longxiadev.store/v1".to_string(),
        api_key: String::new(),
        models: vec!["gpt-5.5".to_string(), "gpt-5.4".to_string()],
        default_model: "gpt-5.5".to_string(),
        think_model: "gpt-5.5".to_string(),
        supports_responses: true,
        supports_chat_completions: true,
        enabled: true,
        notes: "OpenAI-compatible relay template".to_string(),
    }
}

pub fn longxia_codex_member() -> CodexPoolMember {
    CodexPoolMember {
        id: "longxia-key-1".to_string(),
        name: "Longxia Key 1".to_string(),
        api_base: "https://api.longxiadev.store/v1".to_string(),
        api_key: String::new(),
        models: vec!["gpt-5.5".to_string(), "gpt-5.4".to_string()],
        default_model: "gpt-5.5".to_string(),
        weight: 100,
        priority: 1,
        enabled: true,
        max_concurrent_requests: 2,
        cooldown_seconds: 120,
        health: "unknown".to_string(),
        last_checked_at: None,
        last_error: None,
        cooldown_until: None,
        inflight: 0,
        success_count: 0,
        failure_count: 0,
    }
}

pub fn default_codex_pool() -> CodexPool {
    CodexPool {
        id: "default-codex-pool".to_string(),
        name: "Default Codex API Pool".to_string(),
        members: vec![longxia_codex_member()],
        round_robin_cursor: 0,
    }
}
