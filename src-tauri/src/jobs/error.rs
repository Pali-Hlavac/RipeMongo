//! Errors of the jobs module.

use crate::error::{AppError, ErrorCode};

/// Why a job request was refused.
#[derive(Debug, thiserror::Error)]
pub enum JobsError {
    #[error("This job no longer exists.")]
    NotFound,
    #[error("This job is still running.")]
    Running,
}

impl From<JobsError> for AppError {
    fn from(error: JobsError) -> Self {
        let message = error.to_string();
        match error {
            JobsError::NotFound => AppError::new(ErrorCode::NotFound, message),
            JobsError::Running => AppError::new(ErrorCode::InvalidInput, message)
                .with_hint("Cancel the job first, or wait until it finishes."),
        }
    }
}
