use std::{net::SocketAddr, sync::Arc};

use axum::{extract::State, response::IntoResponse, routing::get, Json, Router};
use serde_json::json;
use tokio::{net::TcpListener, sync::oneshot};

use crate::state::AppState;

pub async fn serve_claude(
    state: Arc<AppState>,
    port: u16,
    shutdown: oneshot::Receiver<()>,
) -> anyhow::Result<()> {
    let app = Router::new()
        .route("/health", get(health))
        .route("/models", get(models))
        .with_state(state);

    let addr = SocketAddr::from(([127, 0, 0, 1], port));
    let listener = TcpListener::bind(addr).await?;
    axum::serve(listener, app)
        .with_graceful_shutdown(async {
            let _ = shutdown.await;
        })
        .await?;
    Ok(())
}

async fn health() -> impl IntoResponse {
    Json(json!({ "status": "ok", "target": "claude" }))
}

async fn models(State(state): State<Arc<AppState>>) -> impl IntoResponse {
    let config = state.config.lock().expect("config lock poisoned");
    let provider = config
        .providers
        .iter()
        .find(|provider| provider.id == config.active_claude_provider_id)
        .or_else(|| config.providers.first());

    let models = provider
        .map(|provider| provider.models.clone())
        .unwrap_or_default();

    Json(json!({
        "object": "list",
        "data": models.into_iter().map(|id| json!({ "id": id, "object": "model" })).collect::<Vec<_>>()
    }))
}
