use axum::{extract::State, response::Json};
use serde::Serialize;
use std::sync::Arc;

use crate::state::AppState;

#[derive(Serialize)]
pub struct HealthResponse {
    status:  &'static str,
    version: &'static str,
    server:  &'static str,
}

/// `GET /api/v1/health`
///
/// Returns a simple JSON health check.  Useful for load balancers,
/// monitoring agents, and readiness probes.
pub async fn get_health(_state: State<Arc<AppState>>) -> Json<HealthResponse> {
    Json(HealthResponse {
        status:  "ok",
        version: env!("CARGO_PKG_VERSION"),
        server:  env!("CARGO_PKG_NAME"),
    })
}
