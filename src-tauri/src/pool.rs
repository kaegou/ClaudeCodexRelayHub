use chrono::{DateTime, Duration, Utc};

use crate::models::{AppConfig, CodexPoolMember};

pub fn choose_member(config: &mut AppConfig) -> Option<CodexPoolMember> {
    match config.codex_pool_policy.as_str() {
        "priority-failover" => choose_priority(config),
        "round-robin" => choose_round_robin(config),
        _ => choose_weighted(config),
    }
}

pub fn mark_success(config: &mut AppConfig, member_id: &str) {
    if let Some(member) = config.codex_pool.members.iter_mut().find(|m| m.id == member_id) {
        member.health = "healthy".to_string();
        member.last_error = None;
        member.cooldown_until = None;
        member.success_count += 1;
        member.inflight = member.inflight.saturating_sub(1);
    }
}

pub fn mark_failure(config: &mut AppConfig, member_id: &str, status: Option<u16>, error: String) {
    if let Some(member) = config.codex_pool.members.iter_mut().find(|m| m.id == member_id) {
        member.failure_count += 1;
        member.inflight = member.inflight.saturating_sub(1);
        member.last_error = Some(error);
        match status {
            Some(401) | Some(403) => {
                member.health = "auth_error".to_string();
            }
            Some(429) => {
                member.health = "rate_limited".to_string();
                member.cooldown_until = Some((Utc::now() + Duration::seconds(member.cooldown_seconds as i64)).to_rfc3339());
            }
            Some(code) if code >= 500 => {
                member.health = "server_error".to_string();
                member.cooldown_until = Some((Utc::now() + Duration::seconds(30)).to_rfc3339());
            }
            _ => {
                member.health = "server_error".to_string();
                member.cooldown_until = Some((Utc::now() + Duration::seconds(30)).to_rfc3339());
            }
        }
    }
}

fn choose_priority(config: &mut AppConfig) -> Option<CodexPoolMember> {
    let mut candidates = eligible_indices(config);
    candidates.sort_by_key(|&idx| config.codex_pool.members[idx].priority);
    take_member(config, candidates.first().copied())
}

fn choose_weighted(config: &mut AppConfig) -> Option<CodexPoolMember> {
    let mut candidates = eligible_indices(config);
    candidates.sort_by(|&a, &b| {
        config.codex_pool.members[a]
            .priority
            .cmp(&config.codex_pool.members[b].priority)
            .then(config.codex_pool.members[b].weight.cmp(&config.codex_pool.members[a].weight))
            .then(config.codex_pool.members[a].inflight.cmp(&config.codex_pool.members[b].inflight))
    });
    take_member(config, candidates.first().copied())
}

fn choose_round_robin(config: &mut AppConfig) -> Option<CodexPoolMember> {
    let candidates = eligible_indices(config);
    if candidates.is_empty() {
        return None;
    }
    let cursor = config.codex_pool.round_robin_cursor % candidates.len();
    config.codex_pool.round_robin_cursor = (config.codex_pool.round_robin_cursor + 1) % candidates.len();
    take_member(config, Some(candidates[cursor]))
}

fn take_member(config: &mut AppConfig, idx: Option<usize>) -> Option<CodexPoolMember> {
    let idx = idx?;
    let member = &mut config.codex_pool.members[idx];
    member.inflight += 1;
    Some(member.clone())
}

fn eligible_indices(config: &AppConfig) -> Vec<usize> {
    config
        .codex_pool
        .members
        .iter()
        .enumerate()
        .filter_map(|(idx, member)| is_eligible(member).then_some(idx))
        .collect()
}

fn is_eligible(member: &CodexPoolMember) -> bool {
    if !member.enabled || member.api_key.trim().is_empty() || member.api_base.trim().is_empty() {
        return false;
    }
    if member.health == "auth_error" || member.health == "disabled" {
        return false;
    }
    if member.max_concurrent_requests > 0 && member.inflight >= member.max_concurrent_requests {
        return false;
    }
    if let Some(until) = &member.cooldown_until {
        if let Ok(until) = DateTime::parse_from_rfc3339(until) {
            if until.with_timezone(&Utc) > Utc::now() {
                return false;
            }
        }
    }
    true
}
