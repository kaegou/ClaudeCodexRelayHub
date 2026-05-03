use serde::{Deserialize, Serialize};

use crate::config::{default_codex_pool, longxia_claude_provider};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AppConfig {
    pub active_claude_provider_id: String,
    pub codex_pool_id: String,
    pub claude_proxy_port: u16,
    pub codex_proxy_port: u16,
    pub codex_pool_policy: String,
    pub local_proxy_token: String,
    pub providers: Vec<ProviderProfile>,
    pub codex_pool: CodexPool,
}

impl Default for AppConfig {
    fn default() -> Self {
        Self {
            active_claude_provider_id: "longxia-claude".to_string(),
            codex_pool_id: "default-codex-pool".to_string(),
            claude_proxy_port: 3457,
            codex_proxy_port: 3458,
            codex_pool_policy: "weighted-failover".to_string(),
            local_proxy_token: "local-codex-relay".to_string(),
            providers: vec![longxia_claude_provider()],
            codex_pool: default_codex_pool(),
        }
    }
}

impl AppConfig {
    pub fn ensure_defaults(&mut self) {
        if self.providers.is_empty() {
            self.providers.push(longxia_claude_provider());
        }
        if self.codex_pool.members.is_empty() {
            self.codex_pool = default_codex_pool();
        }
        if self.active_claude_provider_id.is_empty() {
            self.active_claude_provider_id = self.providers[0].id.clone();
        }
        if self.codex_pool_id.is_empty() {
            self.codex_pool_id = "default-codex-pool".to_string();
        }
        if self.claude_proxy_port == 0 {
            self.claude_proxy_port = 3457;
        }
        if self.codex_proxy_port == 0 {
            self.codex_proxy_port = 3458;
        }
        if !matches!(
            self.codex_pool_policy.as_str(),
            "priority-failover" | "round-robin" | "weighted-failover"
        ) {
            self.codex_pool_policy = "weighted-failover".to_string();
        }
        if self.local_proxy_token.is_empty() {
            self.local_proxy_token = "local-codex-relay".to_string();
        }
        for provider in &mut self.providers {
            if provider.health.is_empty() {
                provider.health = "unknown".to_string();
            }
        }
        for member in &mut self.codex_pool.members {
            if member.weight == 0 {
                member.weight = 1;
            }
            if member.weight > 10_000 {
                member.weight = 10_000;
            }
            if member.priority == 0 {
                member.priority = 1;
            }
            if member.priority > 10_000 {
                member.priority = 10_000;
            }
            if member.max_concurrent_requests > 1_000 {
                member.max_concurrent_requests = 1_000;
            }
            if member.cooldown_seconds > 86_400 {
                member.cooldown_seconds = 86_400;
            }
            if member.health.is_empty() {
                member.health = "unknown".to_string();
            }
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProviderProfile {
    pub id: String,
    pub name: String,
    pub target: String,
    pub protocol: String,
    pub api_base: String,
    pub api_key: String,
    pub models: Vec<String>,
    pub default_model: String,
    pub think_model: String,
    pub supports_responses: bool,
    pub supports_chat_completions: bool,
    pub enabled: bool,
    pub notes: String,
    #[serde(default)]
    pub health: String,
    #[serde(default)]
    pub last_checked_at: Option<String>,
    #[serde(default)]
    pub last_error: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CodexPool {
    pub id: String,
    pub name: String,
    pub members: Vec<CodexPoolMember>,
    pub round_robin_cursor: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CodexPoolMember {
    pub id: String,
    pub name: String,
    pub api_base: String,
    pub api_key: String,
    pub models: Vec<String>,
    pub default_model: String,
    pub weight: u32,
    pub priority: u32,
    pub enabled: bool,
    pub max_concurrent_requests: u32,
    pub cooldown_seconds: u64,
    pub health: String,
    pub last_checked_at: Option<String>,
    pub last_error: Option<String>,
    pub cooldown_until: Option<String>,
    pub inflight: u32,
    pub success_count: u64,
    pub failure_count: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProxyStatus {
    pub codex_running: bool,
    pub claude_running: bool,
    pub codex_port: u16,
    pub claude_port: u16,
    pub codex_port_available: bool,
    pub claude_port_available: bool,
    pub last_codex_member_id: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LocalProxyDiagnostic {
    pub target: String,
    pub url: String,
    pub ok: bool,
    pub status: Option<u16>,
    pub duration_ms: u128,
    pub message: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LocalProxyDiagnostics {
    pub codex: LocalProxyDiagnostic,
    pub claude: LocalProxyDiagnostic,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RequestLogEntry {
    pub timestamp: String,
    pub target: String,
    pub member_id: Option<String>,
    pub method: String,
    pub path: String,
    pub status: u16,
    pub duration_ms: u128,
    pub message: String,
}
