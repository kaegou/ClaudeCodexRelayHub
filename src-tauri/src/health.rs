use std::{sync::Arc, time::Duration};

use chrono::Utc;
use tauri::AppHandle;

use crate::{
    config,
    models::{CodexPoolMember, ProviderProfile},
    provider_client,
    state::AppState,
};

const REFRESH_INTERVAL: Duration = Duration::from_secs(5 * 60);

pub fn start(app: AppHandle, state: Arc<AppState>) {
    tauri::async_runtime::spawn(async move {
        loop {
            tokio::time::sleep(REFRESH_INTERVAL).await;
            if let Err(error) = refresh_once(&app, &state).await {
                state
                    .logs
                    .info("health", format!("Health refresh failed: {error}"));
            }
        }
    });
}

pub async fn refresh_once(app: &AppHandle, state: &Arc<AppState>) -> anyhow::Result<()> {
    let (providers, members) = {
        let config = state.config.lock().expect("config lock poisoned");
        (
            config
                .providers
                .iter()
                .filter(|provider| should_check_provider(provider))
                .cloned()
                .collect::<Vec<_>>(),
            config
                .codex_pool
                .members
                .iter()
                .filter(|member| should_check_member(member))
                .cloned()
                .collect::<Vec<_>>(),
        )
    };

    if providers.is_empty() && members.is_empty() {
        return Ok(());
    }

    let mut checked_providers = Vec::with_capacity(providers.len());
    for provider in providers {
        let checked = match provider_client::test_provider(&state.http, provider.clone()).await {
            Ok(provider) => provider,
            Err(error) => provider_with_error(provider, error.to_string()),
        };
        state.logs.info(
            "health",
            format!(
                "Provider {} health refreshed: {}",
                checked.name, checked.health
            ),
        );
        checked_providers.push(checked);
    }

    let mut checked_members = Vec::with_capacity(members.len());
    for member in members {
        let checked = match provider_client::test_member(&state.http, member.clone()).await {
            Ok(member) => member,
            Err(error) => member_with_error(member, error.to_string()),
        };
        state.logs.info(
            "health",
            format!(
                "Codex member {} health refreshed: {}",
                checked.name, checked.health
            ),
        );
        checked_members.push(checked);
    }

    let mut config = state.config.lock().expect("config lock poisoned");
    for checked in checked_providers {
        if let Some(provider) = config
            .providers
            .iter_mut()
            .find(|provider| provider.id == checked.id)
        {
            *provider = checked;
        }
    }
    for checked in checked_members {
        if let Some(member) = config
            .codex_pool
            .members
            .iter_mut()
            .find(|member| member.id == checked.id)
        {
            let inflight = member.inflight;
            *member = checked;
            member.inflight = inflight;
        }
    }
    config::save_config(app, &config)?;
    Ok(())
}

fn should_check_provider(provider: &ProviderProfile) -> bool {
    provider.enabled
        && provider.protocol == "openai-compatible"
        && !provider.api_base.trim().is_empty()
        && !provider.api_key.trim().is_empty()
}

fn should_check_member(member: &CodexPoolMember) -> bool {
    member.enabled && !member.api_base.trim().is_empty() && !member.api_key.trim().is_empty()
}

fn provider_with_error(mut provider: ProviderProfile, error: String) -> ProviderProfile {
    provider.health = status_from_error(&error);
    provider.last_checked_at = Some(Utc::now().to_rfc3339());
    provider.last_error = Some(error);
    provider
}

fn member_with_error(mut member: CodexPoolMember, error: String) -> CodexPoolMember {
    member.health = status_from_error(&error);
    member.last_checked_at = Some(Utc::now().to_rfc3339());
    member.last_error = Some(error);
    member
}

fn status_from_error(error: &str) -> String {
    if error.contains("HTTP 401") || error.contains("HTTP 403") {
        "auth_error"
    } else if error.contains("HTTP 429") {
        "rate_limited"
    } else {
        "server_error"
    }
    .to_string()
}
