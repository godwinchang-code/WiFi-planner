use crate::config::Config;

/// Application-wide state shared across all request handlers via
/// [`axum::extract::State`].
///
/// Currently holds only configuration.  Future extensions can be added here
/// without touching the router setup:
///
/// ```text
/// pub db:         sqlx::SqlitePool,         // persistent plan storage
/// pub plan_cache: Arc<RwLock<PlanCache>>,   // in-memory cache
/// pub broadcast:  tokio::sync::broadcast::Sender<Event>,  // live updates
/// ```
#[derive(Clone, Debug)]
pub struct AppState {
    // Publicly accessible so future API handlers can read config fields directly.
    #[allow(dead_code)]
    pub config: Config,
}

impl AppState {
    pub fn new(config: Config) -> Self {
        Self { config }
    }
}
