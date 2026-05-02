use std::{net::SocketAddr, sync::Arc, time::Instant};

use axum::{
    body::Bytes,
    extract::{Path, State},
    http::{HeaderMap, Method, StatusCode},
    response::{IntoResponse, Response},
    routing::{any, get},
    Json, Router,
};
use chrono::Utc;
use serde_json::{json, Value};
use tokio::{net::TcpListener, sync::oneshot};

use crate::{logging::sanitize, models::RequestLogEntry, pool, state::AppState};

pub async fn serve_codex(
    state: Arc<AppState>,
    port: u16,
    shutdown: oneshot::Receiver<()>,
) -> anyhow::Result<()> {
    let app = Router::new()
        .route("/health", get(health))
        .route("/v1/models", get(models))
        .route("/v1/:endpoint", any(forward_root))
        .route("/v1/:category/:endpoint", any(forward_nested))
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
    Json(json!({ "status": "ok", "target": "codex" }))
}

async fn models(State(state): State<Arc<AppState>>, headers: HeaderMap) -> Response {
    let start = Instant::now();
    if let Some(response) = authorize(&state, &headers) {
        return response;
    }
    let member = {
        let mut config = state.config.lock().expect("config lock poisoned");
        pool::choose_member(&mut config)
    };

    let Some(member) = member else {
        return openai_error(
            StatusCode::SERVICE_UNAVAILABLE,
            "no_available_member",
            "No healthy Codex pool member is available",
        );
    };

    *state
        .last_codex_member_id
        .lock()
        .expect("member lock poisoned") = Some(member.id.clone());
    let url = format!("{}/models", member.api_base.trim_end_matches('/'));
    let response = state
        .http
        .get(url)
        .bearer_auth(&member.api_key)
        .send()
        .await;
    handle_upstream_response(state, member.id, "GET", "/v1/models", None, start, response).await
}

async fn forward_root(
    State(state): State<Arc<AppState>>,
    Path(endpoint): Path<String>,
    method: Method,
    headers: HeaderMap,
    body: Bytes,
) -> Response {
    forward(state, method, headers, format!("/{endpoint}"), body).await
}

async fn forward_nested(
    State(state): State<Arc<AppState>>,
    Path((category, endpoint)): Path<(String, String)>,
    method: Method,
    headers: HeaderMap,
    body: Bytes,
) -> Response {
    forward(
        state,
        method,
        headers,
        format!("/{category}/{endpoint}"),
        body,
    )
    .await
}

async fn forward(
    state: Arc<AppState>,
    method: Method,
    headers: HeaderMap,
    path: String,
    body: Bytes,
) -> Response {
    let start = Instant::now();
    if let Some(response) = authorize(&state, &headers) {
        return response;
    }
    let member = {
        let mut config = state.config.lock().expect("config lock poisoned");
        pool::choose_member(&mut config)
    };

    let Some(member) = member else {
        return openai_error(
            StatusCode::SERVICE_UNAVAILABLE,
            "no_available_member",
            "No healthy Codex pool member is available",
        );
    };

    *state
        .last_codex_member_id
        .lock()
        .expect("member lock poisoned") = Some(member.id.clone());
    let url = format!("{}{}", member.api_base.trim_end_matches('/'), path);
    let mut request = state
        .http
        .request(method.clone(), url)
        .bearer_auth(&member.api_key);

    for (name, value) in headers.iter() {
        let name_text = name.as_str().to_ascii_lowercase();
        if matches!(
            name_text.as_str(),
            "authorization" | "host" | "content-length"
        ) {
            continue;
        }
        request = request.header(name, value);
    }

    let model = extract_model(&body);
    let response = request.body(body).send().await;
    handle_upstream_response(
        state,
        member.id,
        method.as_str(),
        &format!("/v1{path}"),
        model,
        start,
        response,
    )
    .await
}

async fn handle_upstream_response(
    state: Arc<AppState>,
    member_id: String,
    method: &str,
    path: &str,
    model: Option<String>,
    start: Instant,
    response: Result<reqwest::Response, reqwest::Error>,
) -> Response {
    match response {
        Ok(response) => {
            let status = response.status();
            let status_code = status.as_u16();
            let headers = response.headers().clone();
            let body = response.bytes().await.unwrap_or_default();

            {
                let mut config = state.config.lock().expect("config lock poisoned");
                if status.is_success() {
                    pool::mark_success(&mut config, &member_id);
                } else {
                    pool::mark_failure(
                        &mut config,
                        &member_id,
                        Some(status_code),
                        format!("HTTP {status_code}"),
                    );
                }
            }

            state.logs.push(RequestLogEntry {
                timestamp: Utc::now().to_rfc3339(),
                target: "codex".to_string(),
                member_id: Some(member_id),
                method: method.to_string(),
                path: path.to_string(),
                status: status_code,
                duration_ms: start.elapsed().as_millis(),
                message: sanitize(&log_message(status_code, model.as_deref())),
            });

            let mut builder = Response::builder().status(status);
            for (name, value) in headers.iter() {
                let name_text = name.as_str().to_ascii_lowercase();
                if matches!(
                    name_text.as_str(),
                    "content-length" | "connection" | "transfer-encoding"
                ) {
                    continue;
                }
                builder = builder.header(name, value);
            }
            builder
                .body(axum::body::Body::from(body))
                .unwrap_or_else(|_| {
                    openai_error(
                        StatusCode::BAD_GATEWAY,
                        "bad_gateway",
                        "Failed to build upstream response",
                    )
                })
        }
        Err(error) => {
            {
                let mut config = state.config.lock().expect("config lock poisoned");
                pool::mark_failure(&mut config, &member_id, None, error.to_string());
            }
            state.logs.push(RequestLogEntry {
                timestamp: Utc::now().to_rfc3339(),
                target: "codex".to_string(),
                member_id: Some(member_id),
                method: method.to_string(),
                path: path.to_string(),
                status: 502,
                duration_ms: start.elapsed().as_millis(),
                message: sanitize(&match model.as_deref() {
                    Some(model) => format!("{} model={model}", error),
                    None => error.to_string(),
                }),
            });
            openai_error(
                StatusCode::BAD_GATEWAY,
                "bad_gateway",
                "Failed to reach upstream provider",
            )
        }
    }
}

fn extract_model(body: &Bytes) -> Option<String> {
    serde_json::from_slice::<Value>(body)
        .ok()
        .and_then(|value| {
            value
                .get("model")
                .and_then(Value::as_str)
                .map(str::to_string)
        })
}

fn log_message(status_code: u16, model: Option<&str>) -> String {
    match model {
        Some(model) => format!("upstream HTTP {status_code} model={model}"),
        None => format!("upstream HTTP {status_code}"),
    }
}

fn authorize(state: &AppState, headers: &HeaderMap) -> Option<Response> {
    let token = state
        .config
        .lock()
        .expect("config lock poisoned")
        .local_proxy_token
        .clone();

    if token.trim().is_empty() {
        return None;
    }

    let bearer_ok = headers
        .get("authorization")
        .and_then(|value| value.to_str().ok())
        .map(|value| value == format!("Bearer {token}"))
        .unwrap_or(false);

    let key_ok = headers
        .get("x-api-key")
        .and_then(|value| value.to_str().ok())
        .map(|value| value == token)
        .unwrap_or(false);

    if bearer_ok || key_ok {
        None
    } else {
        Some(openai_error(
            StatusCode::UNAUTHORIZED,
            "authentication_error",
            "Invalid local proxy token",
        ))
    }
}

fn openai_error(status: StatusCode, code: &str, message: &str) -> Response {
    (
        status,
        Json(json!({
            "error": {
                "message": message,
                "type": code,
                "code": code
            }
        })),
    )
        .into_response()
}
