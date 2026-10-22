//! Errors of the query history store.

use crate::error::{AppError, ErrorCode};
use crate::storage::StorageError;

#[derive(Debug, thiserror::Error)]
pub enum QueryHistoryError {
    #[error(transparent)]
    Storage(#[from] StorageError),
    #[error("{0}")]
    Invalid(String),
}

impl From<QueryHistoryError> for AppError {
    fn from(error: QueryHistoryError) -> Self {
        match error {
            QueryHistoryError::Storage(error) => error.into(),
            QueryHistoryError::Invalid(message) => AppError::new(ErrorCode::InvalidInput, message),
        }
    }
}
