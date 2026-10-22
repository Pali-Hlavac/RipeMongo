//! Connection-domain errors and their mapping to user-facing [`AppError`]s.

use super::uri::UriError;
use crate::error::{AppError, ErrorCode};
use crate::mongo::driver_error;
use crate::secrets::SecretsError;
use crate::ssh::SshError;
use crate::storage::StorageError;

/// Failure modes of the connections service.
#[derive(Debug, thiserror::Error)]
pub enum ConnectionError {
    #[error("connection {0} not found")]
    NotFound(String),
    #[error("connection {0} is not connected")]
    NotConnected(String),
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
            ConnectionError::NotConnected(_) => {
                AppError::new(ErrorCode::NotConnected, "This connection is not open.")
                    .with_hint("Connect to it first (double-click it in the sidebar).")
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
