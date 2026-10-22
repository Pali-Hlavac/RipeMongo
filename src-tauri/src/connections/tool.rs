//! What the bundled tools need to reach a live connection.

use std::sync::Arc;

use super::registry::ActiveConnection;
use super::uri::build_connection_string;
use super::ConnectionSecrets;

/// A connection string for a tool, with and without secrets. Holding it keeps the live
/// connection's SSH tunnel open. Deliberately not `Debug`: it contains the password.
pub struct ToolConnection {
    uri: String,
    display_uri: String,
    lease: Arc<ActiveConnection>,
}

impl ToolConnection {
    pub(super) fn new(active: Arc<ActiveConnection>, secrets: &ConnectionSecrets) -> Self {
        Self {
            uri: build_connection_string(&active.effective, Some(secrets)),
            display_uri: build_connection_string(&active.effective, None),
            lease: active,
        }
    }

    /// The connection string including credentials. Only for the tool's `--config` file.
    pub fn uri(&self) -> &str {
        &self.uri
    }

    /// The connection string without any secret, safe to show and log.
    pub fn display_uri(&self) -> &str {
        &self.display_uri
    }

    /// The driver client of the same connection (used to estimate totals).
    pub fn client(&self) -> &mongodb::Client {
        &self.lease.client
    }
}
