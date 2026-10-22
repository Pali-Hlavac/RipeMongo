//! Errors raised while reading or writing settings, and their mapping to [`AppError`].

use std::path::PathBuf;

use crate::error::{AppError, ErrorCode};

/// Failure modes of the settings store.
#[derive(Debug, thiserror::Error)]
pub enum SettingsError {
    #[error("could not access settings file {path}: {source}")]
    Io {
        path: PathBuf,
        #[source]
        source: std::io::Error,
    },
    #[error("settings file {path} is not valid JSON: {source}")]
    Parse {
        path: PathBuf,
        #[source]
        source: serde_json::Error,
    },
    #[error("could not serialize settings: {0}")]
    Serialize(#[source] serde_json::Error),
}

impl From<SettingsError> for AppError {
    fn from(error: SettingsError) -> Self {
        tracing::error!(%error, "settings operation failed");
        match error {
            SettingsError::Io { path, .. } => AppError::new(
                ErrorCode::Io,
                format!(
                    "Could not read or write the settings file at {}.",
                    path.display()
                ),
            )
            .with_hint("Check that the folder exists and that you have permission to write to it."),
            SettingsError::Parse { path, .. } => AppError::new(
                ErrorCode::InvalidData,
                format!("The settings file at {} is corrupted.", path.display()),
            )
            .with_hint("Delete or fix the file; RipeMongo will recreate it with default settings."),
            SettingsError::Serialize(_) => {
                AppError::new(ErrorCode::Internal, "Could not save settings.")
            }
        }
    }
}
