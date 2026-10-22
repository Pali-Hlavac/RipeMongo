//! Application-wide error model that crosses the IPC boundary.
//!
//! Every domain module defines its own `thiserror` enum and converts it into
//! [`AppError`] via `From`. Only [`AppError`] is ever serialized to the frontend.

use serde::Serialize;
use specta::Type;

/// Stable, machine-readable error category the frontend can branch on.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Type)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum ErrorCode {
    /// An unexpected failure inside the app; usually a bug.
    Internal,
    /// Reading or writing a local file failed.
    Io,
    /// Data on disk or from the user could not be parsed.
    InvalidData,
    /// The user-provided input is incomplete or contradictory.
    InvalidInput,
    /// The requested item (e.g. a saved connection) does not exist.
    NotFound,
    /// The OS keychain is unavailable or refused access.
    Keychain,
    /// The MongoDB server could not be reached or selected.
    ConnectionFailed,
    /// The server rejected the credentials.
    AuthFailed,
    /// Establishing or using the SSH tunnel failed.
    SshFailed,
}

/// Serializable error returned by every fallible Tauri command.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct AppError {
    /// Category used by the UI to pick an icon, retry policy, etc.
    pub code: ErrorCode,
    /// What happened, phrased for an end user.
    pub message: String,
    /// What the user can do next, if there is anything useful to suggest.
    pub hint: Option<String>,
}

impl AppError {
    /// Creates an error without a hint.
    pub fn new(code: ErrorCode, message: impl Into<String>) -> Self {
        Self {
            code,
            message: message.into(),
            hint: None,
        }
    }

    /// Attaches a "what to do next" hint to the error.
    #[must_use]
    pub fn with_hint(mut self, hint: impl Into<String>) -> Self {
        self.hint = Some(hint.into());
        self
    }
}

impl std::fmt::Display for AppError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "{:?}: {}", self.code, self.message)
    }
}

impl std::error::Error for AppError {}

/// Result alias used by Tauri command handlers.
pub type CommandResult<T> = Result<T, AppError>;

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn serializes_with_camel_case_and_screaming_code() {
        let error = AppError::new(ErrorCode::InvalidData, "bad").with_hint("fix it");
        let json = serde_json::to_value(&error).unwrap();
        assert_eq!(
            json,
            serde_json::json!({ "code": "INVALID_DATA", "message": "bad", "hint": "fix it" })
        );
    }

    #[test]
    fn hint_is_null_when_absent() {
        let json = serde_json::to_value(AppError::new(ErrorCode::Io, "x")).unwrap();
        assert!(json["hint"].is_null());
    }
}
