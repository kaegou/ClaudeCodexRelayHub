use anyhow::{anyhow, Result};
use chrono::Utc;
use reqwest::Client;

use crate::models::{CodexPoolMember, ProviderProfile};

pub async fn test_member(client: &Client, mut member: CodexPoolMember) -> Result<CodexPoolMember> {
    let base = member.api_base.trim_end_matches('/');
    let url = format!("{base}/models");
    let response = client
        .get(url)
        .bearer_auth(member.api_key.clone())
        .send()
        .await?;
    member.last_checked_at = Some(Utc::now().to_rfc3339());

    if response.status().is_success() {
        member.health = "healthy".to_string();
        member.last_error = None;
        return Ok(member);
    }

    let status = response.status().as_u16();
    member.health = match status {
        401 | 403 => "auth_error",
        429 => "rate_limited",
        500..=599 => "server_error",
        _ => "server_error",
    }
    .to_string();
    member.last_error = Some(format!("HTTP {status}"));
    Err(anyhow!("provider returned HTTP {status}"))
}

pub async fn test_provider(
    client: &Client,
    mut provider: ProviderProfile,
) -> Result<ProviderProfile> {
    let base = provider.api_base.trim_end_matches('/');
    let url = format!("{base}/models");
    let response = client
        .get(url)
        .bearer_auth(provider.api_key.clone())
        .send()
        .await?;
    provider.last_checked_at = Some(Utc::now().to_rfc3339());

    if response.status().is_success() {
        provider.health = "healthy".to_string();
        provider.last_error = None;
        return Ok(provider);
    }

    let status = response.status().as_u16();
    provider.health = match status {
        401 | 403 => "auth_error",
        429 => "rate_limited",
        500..=599 => "server_error",
        _ => "server_error",
    }
    .to_string();
    provider.last_error = Some(format!("HTTP {status}"));
    Err(anyhow!("provider returned HTTP {status}"))
}
