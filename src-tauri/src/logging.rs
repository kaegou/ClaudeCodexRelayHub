use chrono::Utc;
use std::sync::{Arc, Mutex};

use crate::models::RequestLogEntry;

#[derive(Clone, Default)]
pub struct LogStore {
    entries: Arc<Mutex<Vec<RequestLogEntry>>>,
}

impl LogStore {
    pub fn push(&self, entry: RequestLogEntry) {
        let mut entries = self.entries.lock().expect("log lock poisoned");
        entries.push(entry);
        if entries.len() > 500 {
            let overflow = entries.len() - 500;
            entries.drain(0..overflow);
        }
    }

    pub fn list(&self) -> Vec<RequestLogEntry> {
        self.entries.lock().expect("log lock poisoned").clone()
    }

    pub fn info(&self, target: &str, message: impl Into<String>) {
        self.push(RequestLogEntry {
            timestamp: Utc::now().to_rfc3339(),
            target: target.to_string(),
            member_id: None,
            method: "SYSTEM".to_string(),
            path: String::new(),
            status: 0,
            duration_ms: 0,
            message: sanitize(&message.into()),
        });
    }
}

pub fn sanitize(value: &str) -> String {
    let mut out = value.to_string();
    for marker in ["Authorization: Bearer ", "Bearer ", "x-api-key: "] {
        while let Some(pos) = out.find(marker) {
            let start = pos + marker.len();
            let end = out[start..]
                .find(|ch: char| ch.is_whitespace() || ch == ',' || ch == ';')
                .map(|offset| start + offset)
                .unwrap_or(out.len());
            out.replace_range(start..end, "***");
        }
    }
    out
}
