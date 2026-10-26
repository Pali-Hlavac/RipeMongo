//! MongoDB connection strings ⇄ [`ConnectionConfig`].
//!
//! The backend owns this conversion so the form ⇄ URI sync in the UI and the URI used to
//! connect can never disagree. Parsing never performs DNS lookups (SRV is resolved later by
//! the driver). Unknown options are preserved in `extra_options`.

mod build;
mod encode;
mod error;
mod options;
mod parse;
mod redact;
#[cfg(test)]
mod tests;
mod values;

use serde::Serialize;
use specta::Type;

pub use build::build_connection_string;
pub use error::UriError;
pub use redact::{redact_uri, SecretMask};

use super::{ConnectionConfig, ConnectionSecrets};

/// Result of parsing a pasted connection string. Secrets found in the URI (password,
/// session token, key password) are returned separately so the UI can route them into the
/// keychain-backed secret fields instead of the saved config.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct ParsedConnectionString {
    pub config: ConnectionConfig,
    pub secrets: ConnectionSecrets,
}

/// Parses a `mongodb://` or `mongodb+srv://` connection string.
pub fn parse_connection_string(uri: &str) -> Result<ParsedConnectionString, UriError> {
    let raw = parse::split(uri)?;
    let (config, secrets) = options::into_config(raw)?;
    Ok(ParsedConnectionString { config, secrets })
}
