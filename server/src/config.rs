use clap::Parser;

/// WiFi Planner — embedded web server
///
/// Serves the compiled SPA and a versioned REST API.
/// All options can also be set via environment variables (see long option names
/// prefixed with `WIFI_PLANNER_`).
#[derive(Clone, Debug, Parser)]
#[command(name = "wifi-planner-server", version, about, long_about = None)]
pub struct Config {
    /// Bind address (applies to both HTTP and HTTPS)
    #[arg(
        short = 'H',
        long,
        env = "WIFI_PLANNER_HOST",
        default_value = "0.0.0.0"
    )]
    pub host: String,

    /// HTTP port
    #[arg(
        short = 'p',
        long,
        env = "WIFI_PLANNER_PORT",
        default_value_t = 8080
    )]
    pub port: u16,

    /// HTTPS port (only used when --tls-cert and --tls-key are both provided)
    #[arg(long, env = "WIFI_PLANNER_TLS_PORT", default_value_t = 8443)]
    pub tls_port: u16,

    /// Path to TLS certificate (PEM).  Enables HTTPS when set with --tls-key.
    #[arg(long, env = "WIFI_PLANNER_TLS_CERT", value_name = "FILE")]
    pub tls_cert: Option<String>,

    /// Path to TLS private key (PEM)
    #[arg(long, env = "WIFI_PLANNER_TLS_KEY", value_name = "FILE")]
    pub tls_key: Option<String>,

    /// Log level: error | warn | info | debug | trace
    #[arg(
        short = 'l',
        long,
        env = "WIFI_PLANNER_LOG",
        default_value = "info"
    )]
    pub log_level: String,
}
