//! Tracing subscriber setup. Verbosity is controlled with the `RUST_LOG` env var.

use tracing_subscriber::EnvFilter;

/// Filter used when `RUST_LOG` is not set.
#[cfg(debug_assertions)]
const DEFAULT_FILTER: &str = "info,ripemongo_lib=debug";
#[cfg(not(debug_assertions))]
const DEFAULT_FILTER: &str = "warn,ripemongo_lib=info";

/// Installs the global tracing subscriber. Safe to call once at startup.
pub fn init() {
    let filter =
        EnvFilter::try_from_default_env().unwrap_or_else(|_| EnvFilter::new(DEFAULT_FILTER));
    // `try_init` fails only if a subscriber is already installed, which is harmless.
    let _ = tracing_subscriber::fmt().with_env_filter(filter).try_init();
}
