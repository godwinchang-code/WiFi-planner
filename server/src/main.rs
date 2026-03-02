mod api;
mod config;
mod state;

use axum::{
    body::Body,
    http::{header, StatusCode, Uri},
    response::{IntoResponse, Response},
    Router,
};
use axum_server::tls_rustls::RustlsConfig;
use clap::Parser;
use rust_embed::Embed;
use state::AppState;
use std::{net::SocketAddr, sync::Arc};
use tower_http::{
    compression::CompressionLayer,
    cors::CorsLayer,
    trace::TraceLayer,
};
use tracing_subscriber::EnvFilter;

use config::Config;

// ── Embedded frontend assets ─────────────────────────────────────────────────
//
// `rust-embed` walks `../dist/` at compile time and bakes every file into the
// binary.  The build script (`build.rs`) verifies the directory exists and
// emits a friendly error if you forgot to run `npm run build` first.

#[derive(Embed)]
#[folder = "../dist/"]
struct Assets;

// ── Entry point ───────────────────────────────────────────────────────────────

#[tokio::main]
async fn main() {
    let config = Config::parse();

    // Structured logging — level controlled by --log-level / WIFI_PLANNER_LOG
    tracing_subscriber::fmt()
        .with_env_filter(
            EnvFilter::try_from_default_env().unwrap_or_else(|_| {
                EnvFilter::new(format!(
                    "wifi_planner_server={},tower_http=warn",
                    config.log_level
                ))
            }),
        )
        .init();

    let state = Arc::new(AppState::new(config.clone()));

    let app = build_router(state);

    // ── HTTPS mode ────────────────────────────────────────────────────────────
    if let (Some(cert), Some(key)) = (&config.tls_cert, &config.tls_key) {
        let addr: SocketAddr = format!("{}:{}", config.host, config.tls_port)
            .parse()
            .expect("invalid bind address");

        let tls = RustlsConfig::from_pem_file(cert, key)
            .await
            .expect("failed to load TLS certificate / key — check file paths and format");

        tracing::info!("HTTPS listening on https://{}", addr);

        axum_server::bind_rustls(addr, tls)
            .serve(app.into_make_service())
            .await
            .expect("HTTPS server error");

        return;
    }

    // ── HTTP mode ─────────────────────────────────────────────────────────────
    let addr: SocketAddr = format!("{}:{}", config.host, config.port)
        .parse()
        .expect("invalid bind address");

    tracing::info!("HTTP  listening on http://{}", addr);

    axum_server::bind(addr)
        .serve(app.into_make_service())
        .await
        .expect("HTTP server error");
}

// ── Router ────────────────────────────────────────────────────────────────────

fn build_router(state: Arc<AppState>) -> Router {
    Router::new()
        // Versioned REST API
        .nest("/api/v1", api::router(state))
        // Everything else → embedded SPA (index.html for unknown paths)
        .fallback(static_handler)
        // Middleware stack (applied outermost-first)
        .layer(CompressionLayer::new())   // gzip / brotli responses
        .layer(CorsLayer::permissive())   // allow all origins (tighten in production)
        .layer(TraceLayer::new_for_http()) // per-request tracing logs
}

// ── Static file handler ───────────────────────────────────────────────────────

async fn static_handler(uri: Uri) -> Response {
    let path = uri.path().trim_start_matches('/');
    // Root → index.html
    let path = if path.is_empty() { "index.html" } else { path };
    serve_asset(path)
}

/// Serve an embedded asset by path, falling back to `index.html` for unknown
/// paths so that client-side routing works correctly.
fn serve_asset(path: &str) -> Response {
    match Assets::get(path) {
        Some(content) => {
            let mime = mime_guess::from_path(path).first_or_octet_stream();
            Response::builder()
                .header(header::CONTENT_TYPE, mime.as_ref())
                .body(Body::from(content.data.into_owned()))
                .unwrap()
        }
        // Unknown path → serve SPA shell (React Router handles the rest)
        None if path != "index.html" => serve_asset("index.html"),
        // index.html itself is missing (frontend not built)
        _ => StatusCode::NOT_FOUND.into_response(),
    }
}

// ── Tests ─────────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;
    use axum::http::StatusCode;
    use axum_test::TestServer;

    // Only run when dist/ actually exists (i.e. after `npm run build`)
    #[tokio::test]
    #[ignore = "requires dist/ to be built first (npm run build)"]
    async fn health_endpoint_returns_ok() {
        let state = Arc::new(AppState::new(Config {
            host:      "127.0.0.1".into(),
            port:      0,
            tls_port:  0,
            tls_cert:  None,
            tls_key:   None,
            log_level: "error".into(),
        }));
        let app = build_router(state);
        let server = TestServer::new(app).unwrap();

        let resp = server.get("/api/v1/health").await;
        resp.assert_status(StatusCode::OK);

        let body: serde_json::Value = resp.json();
        assert_eq!(body["status"], "ok");
    }
}
