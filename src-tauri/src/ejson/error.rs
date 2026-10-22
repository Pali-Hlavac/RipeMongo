//! Parse errors for user-typed JSON / shell syntax, with line and column for the editor.

use crate::error::{AppError, ErrorCode};

/// Why user-typed JSON could not be understood.
#[derive(Debug, Clone, PartialEq, Eq, thiserror::Error)]
pub enum EjsonError {
    #[error("{message} (line {line}, column {column})")]
    Syntax {
        message: String,
        line: usize,
        column: usize,
    },
    #[error("Expected {expected}, but found {found}.")]
    Expected {
        expected: &'static str,
        found: &'static str,
    },
    #[error("{0}")]
    Invalid(String),
}

impl From<EjsonError> for AppError {
    fn from(error: EjsonError) -> Self {
        AppError::new(ErrorCode::InvalidInput, error.to_string()).with_hint(
            "Use JSON or shell syntax, e.g. { status: \"active\", _id: ObjectId(\"…\") }.",
        )
    }
}
