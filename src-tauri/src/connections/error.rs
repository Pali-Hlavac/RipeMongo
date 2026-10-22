//! Connection-domain errors and their mapping to user-facing [`AppError`]s.

use mongodb::error::ErrorKind;

use super::uri::{redact_uri, UriError};
use crate::error::{AppError, ErrorCode};
use crate::secrets::SecretsError;
use crate::ssh::SshError;
use crate::storage::StorageError;

/// Longest driver message shown to the user; topology dumps can be very long.
const MAX_DETAIL_CHARS: usize = 400;

/// Failure modes of the connections service.
#[derive(Debug, thiserror::Error)]
pub enum ConnectionError {
    #[error("connection {0} not found")]
    NotFound(String),
    #[error("invalid connection settings: {0}")]
    Invalid(String),
    #[error(transparent)]
    Uri(#[from] UriError),
    #[error(transparent)]
    Storage(#[from] StorageError),
    #[error(transparent)]
    Secrets(#[from] SecretsError),
    #[error(transparent)]
    Ssh(#[from] SshError),
    #[error("driver error: {0}")]
    Driver(#[from] mongodb::error::Error),
}

impl From<ConnectionError> for AppError {
    fn from(error: ConnectionError) -> Self {
        match error {
            ConnectionError::NotFound(_) => {
                AppError::new(ErrorCode::NotFound, "This connection no longer exists.")
                    .with_hint("It may have been deleted in another window. Refresh the list.")
            }
            ConnectionError::Invalid(message) => AppError::new(ErrorCode::InvalidInput, message),
            ConnectionError::Uri(error) => {
                AppError::new(ErrorCode::InvalidInput, error.to_string()).with_hint(
                    "Check the connection string format: mongodb://user@host:port/?options",
                )
            }
            ConnectionError::Storage(error) => error.into(),
            ConnectionError::Secrets(error) => error.into(),
            ConnectionError::Ssh(error) => error.into(),
            ConnectionError::Driver(error) => driver_error(&error),
        }
    }
}

fn driver_error(error: &mongodb::error::Error) -> AppError {
    let detail = shorten(&redact_uri(&error.to_string()));
    tracing::warn!(error = %detail, "MongoDB driver error");
    match error.kind.as_ref() {
        ErrorKind::Authentication { .. } => AppError::new(
            ErrorCode::AuthFailed,
            "The server rejected the credentials.",
        )
        .with_hint("Check the user name, password and authentication database (authSource)."),
        ErrorKind::ServerSelection { .. } => AppError::new(
            ErrorCode::ConnectionFailed,
            format!("Could not reach the MongoDB server. {detail}"),
        )
        .with_hint(
            "Check the host and port, that the server is running, firewall/VPN access, the replica set name and TLS settings.",
        ),
        ErrorKind::DnsResolve { .. } => AppError::new(
            ErrorCode::ConnectionFailed,
            format!("DNS lookup failed. {detail}"),
        )
        .with_hint("Check the host name. For mongodb+srv:// the SRV and TXT records must exist."),
        ErrorKind::InvalidArgument { .. } | ErrorKind::InvalidTlsConfig { .. } => {
            AppError::new(ErrorCode::InvalidInput, format!("Invalid connection settings. {detail}"))
                .with_hint("Check the TLS files and connection options.")
        }
        _ => AppError::new(ErrorCode::ConnectionFailed, format!("The connection failed. {detail}")),
    }
}

fn shorten(text: &str) -> String {
    if text.chars().count() <= MAX_DETAIL_CHARS {
        return text.to_owned();
    }
    let truncated: String = text.chars().take(MAX_DETAIL_CHARS).collect();
    format!("{truncated}…")
}
