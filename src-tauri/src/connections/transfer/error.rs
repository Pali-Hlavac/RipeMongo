//! Import/export errors and their user-facing mapping.

use std::path::PathBuf;

use crate::connections::ConnectionError;
use crate::error::{AppError, ErrorCode};

/// Failure modes of connection import/export.
#[derive(Debug, thiserror::Error)]
pub enum TransferError {
    #[error("could not access {path}: {source}")]
    Io {
        path: PathBuf,
        #[source]
        source: std::io::Error,
    },
    #[error("file is too large ({0} bytes)")]
    TooLarge(u64),
    #[error("not a RipeMongo connections file: {0}")]
    InvalidFile(String),
    #[error("unsupported connections file version {0}")]
    UnsupportedVersion(u32),
    #[error("wrong password or modified file")]
    WrongPassword,
    #[error("encryption failed")]
    Crypto,
    #[error(transparent)]
    Connection(#[from] ConnectionError),
}

impl From<TransferError> for AppError {
    fn from(error: TransferError) -> Self {
        tracing::warn!(%error, "connection import/export failed");
        match error {
            TransferError::Io { path, .. } => AppError::new(
                ErrorCode::Io,
                format!("Could not read or write {}.", path.display()),
            )
            .with_hint("Check the file location and your permissions."),
            TransferError::TooLarge(_) | TransferError::InvalidFile(_) => AppError::new(
                ErrorCode::InvalidData,
                "This is not a valid RipeMongo connections file.",
            )
            .with_hint("Choose a file exported from RipeMongo (Export connections)."),
            TransferError::UnsupportedVersion(version) => AppError::new(
                ErrorCode::InvalidData,
                format!("This file was created by a newer RipeMongo (format version {version})."),
            )
            .with_hint("Update RipeMongo and try again."),
            TransferError::WrongPassword => AppError::new(
                ErrorCode::InvalidInput,
                "The password is wrong, or the file was modified.",
            )
            .with_hint("Re-enter the export password, or import without passwords."),
            TransferError::Crypto => {
                AppError::new(ErrorCode::Internal, "Encrypting the passwords failed.")
            }
            TransferError::Connection(error) => error.into(),
        }
    }
}
