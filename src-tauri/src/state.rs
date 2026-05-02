use std::{sync::Mutex, time::Duration};

use reqwest::{Client, ClientBuilder};
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
    pub fn new(config: AppConfig) -> anyhow::Result<Self> {
        Ok(Self {
            config: Mutex::new(config),
            logs: LogStore::default(),
            http: ClientBuilder::new()
                .timeout(Duration::from_secs(90))
                .connect_timeout(Duration::from_secs(15))
                .build()?,
            codex_shutdown: Mutex::new(None),
            claude_shutdown: Mutex::new(None),
            last_codex_member_id: Mutex::new(None),
        })
    }
}
