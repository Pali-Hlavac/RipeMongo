//! Errors of the tools module.

use crate::error::{AppError, ErrorCode};

use super::Tool;

/// Why a bundled tool could not be used.
#[derive(Debug, thiserror::Error)]
pub enum ToolsError {
    /// The binary is not part of this build.
    #[error("{0} is not included in this build of RipeMongo.")]
    Missing(Tool),
    /// The request from the UI is incomplete or contradictory.
    #[error("{0}")]
    Invalid(String),
    /// The temporary credentials file could not be written.
    #[error("Could not prepare the connection settings for the tool: {0}")]
    Credentials(#[source] std::io::Error),
    /// The operating system refused to start the binary.
    #[error("{tool} could not be started: {source}")]
    Start {
        tool: Tool,
        #[source]
        source: std::io::Error,
    },
}

impl From<ToolsError> for AppError {
    fn from(error: ToolsError) -> Self {
        let message = error.to_string();
        match error {
            ToolsError::Missing(_) => AppError::new(ErrorCode::NotFound, message).with_hint(
                "Reinstall RipeMongo. If you built it yourself, run `pnpm sidecars` first.",
            ),
            ToolsError::Invalid(_) => AppError::new(ErrorCode::InvalidInput, message),
            ToolsError::Credentials(_) => AppError::new(ErrorCode::Io, message)
                .with_hint("Check that the temporary folder exists and is writable."),
            ToolsError::Start { .. } => AppError::new(ErrorCode::Io, message)
                .with_hint("Check that security software is not blocking the bundled tools."),
        }
    }
}
