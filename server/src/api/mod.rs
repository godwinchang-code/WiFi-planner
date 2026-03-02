mod health;

use axum::{routing::get, Router};
use std::sync::Arc;

use crate::state::AppState;

/// Assembles the `/api/v1` sub-router.
///
/// ## Current endpoints
///
/// | Method | Path              | Description       |
/// |--------|-------------------|-------------------|
/// | GET    | `/api/v1/health`  | Health / readiness check |
///
/// ## Planned endpoints (add here as features are implemented)
///
/// ```text
/// GET  /api/v1/plans          list saved plans
/// POST /api/v1/plans          create / import a plan
/// GET  /api/v1/plans/:id      retrieve a plan
/// PUT  /api/v1/plans/:id      update a plan
/// DEL  /api/v1/plans/:id      delete a plan
///
/// GET  /api/v1/settings       server-side settings
/// PUT  /api/v1/settings       update settings
/// ```
pub fn router(state: Arc<AppState>) -> Router {
    Router::new()
        .route("/health", get(health::get_health))
        // Future routes are added here; no changes required in main.rs
        .with_state(state)
}
