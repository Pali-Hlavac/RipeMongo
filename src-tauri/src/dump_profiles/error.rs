//! Errors of the saved dumps store.

use crate::error::{AppError, ErrorCode};
use crate::storage::StorageError;
use crate::tools::ToolsError;

#[derive(Debug, thiserror::Error)]
pub enum DumpProfilesError {
    #[error(transparent)]
    Storage(#[from] StorageError),
    /// The dump settings themselves are invalid.
    #[error(transparent)]
    Request(#[from] ToolsError),
    #[error("{0}")]
    Invalid(String),
    #[error("This saved dump no longer exists.")]
    NotFound,
}

impl From<DumpProfilesError> for AppError {
    fn from(error: DumpProfilesError) -> Self {
        match error {
            DumpProfilesError::Storage(error) => error.into(),
            DumpProfilesError::Request(error) => error.into(),
            DumpProfilesError::Invalid(message) => AppError::new(ErrorCode::InvalidInput, message),
            DumpProfilesError::NotFound => {
                AppError::new(ErrorCode::NotFound, DumpProfilesError::NotFound.to_string())
            }
        }
    }
}
