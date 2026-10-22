//! Keychain errors and their user-facing mapping.

use crate::error::{AppError, ErrorCode};

/// Failure modes of a [`SecretStore`](super::SecretStore).
#[derive(Debug, thiserror::Error)]
pub enum SecretsError {
    /// No usable keychain (e.g. no Secret Service on Linux) or access was denied.
    #[error("keychain unavailable: {0}")]
    Unavailable(String),
    /// Any other platform failure.
    #[error("keychain operation failed: {0}")]
    Platform(String),
}

impl From<keyring::Error> for SecretsError {
    fn from(error: keyring::Error) -> Self {
        match error {
            keyring::Error::NoDefaultStore | keyring::Error::NoStorageAccess(_) => {
                Self::Unavailable(error.to_string())
            }
            other => Self::Platform(other.to_string()),
        }
    }
}

impl From<SecretsError> for AppError {
    fn from(error: SecretsError) -> Self {
        tracing::error!(%error, "keychain operation failed");
        match error {
            SecretsError::Unavailable(_) => AppError::new(
                ErrorCode::Keychain,
                "The system keychain is not available, so passwords cannot be stored securely.",
            )
            .with_hint(
                "Unlock your keychain. On Linux, install and start a Secret Service provider such as GNOME Keyring or KWallet.",
            ),
            SecretsError::Platform(_) => AppError::new(
                ErrorCode::Keychain,
                "Reading or writing a password in the system keychain failed.",
            )
            .with_hint("Try again; if it keeps failing, check the keychain app for locked or corrupted entries."),
        }
    }
}
