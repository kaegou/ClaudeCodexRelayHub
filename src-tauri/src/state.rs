use std::sync::Mutex;

use reqwest::Client;
use tokio::sync::oneshot;

use crate::{logging::LogStore, models::AppConfig};

pub struct AppState {
    pub config: Mutex<AppConfig>,
    pub logs: LogStore,
    pub http: Client,
    pub codex_shutdown: Mutex<Option<oneshot::Sender<()>>>,
    pub claude_shutdown: Mutex<Option<oneshot::Sender<()>>>,
    pub last_codex_member_id: Mutex<Option<String>>,
}

impl AppState {
    pub fn new(config: AppConfig) -> Self {
        Self {
            config: Mutex::new(config),
            logs: LogStore::default(),
            http: Client::new(),
            codex_shutdown: Mutex::new(None),
            claude_shutdown: Mutex::new(None),
            last_codex_member_id: Mutex::new(None),
        }
    }
}
