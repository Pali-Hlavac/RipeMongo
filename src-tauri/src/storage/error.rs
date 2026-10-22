//! Errors raised by [`JsonFile`](super::JsonFile) and their mapping to [`AppError`].

use std::path::PathBuf;

use crate::error::{AppError, ErrorCode};

/// Failure modes of file-backed JSON documents.
#[derive(Debug, thiserror::Error)]
pub enum StorageError {
    #[error("could not access {path}: {source}")]
    Io {
        path: PathBuf,
        #[source]
        source: std::io::Error,
    },
    #[error("{path} is not valid JSON: {source}")]
    Parse {
        path: PathBuf,
        #[source]
        source: serde_json::Error,
    },
    #[error("could not serialize document: {0}")]
    Serialize(#[source] serde_json::Error),
}

impl From<StorageError> for AppError {
    fn from(error: StorageError) -> Self {
        tracing::error!(%error, "storage operation failed");
        match error {
            StorageError::Io { path, .. } => AppError::new(
                ErrorCode::Io,
                format!("Could not read or write {}.", path.display()),
            )
            .with_hint("Check that the folder exists and that you have permission to write to it."),
            StorageError::Parse { path, .. } => AppError::new(
                ErrorCode::InvalidData,
                format!("The file {} is corrupted.", path.display()),
            )
            .with_hint("Fix or delete the file; RipeMongo recreates it with defaults."),
            StorageError::Serialize(_) => {
                AppError::new(ErrorCode::Internal, "Could not save data.")
            }
        }
    }
}
