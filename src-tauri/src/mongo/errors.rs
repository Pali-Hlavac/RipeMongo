//! Error type for data operations, and the single place where driver and server errors are
//! translated into user-facing [`AppError`]s (with secrets redacted).

use mongodb::error::{ErrorKind, WriteFailure};

use crate::connections::uri::redact_uri;
use crate::connections::ConnectionError;
use crate::ejson::EjsonError;
use crate::error::{AppError, ErrorCode};

/// Longest server/driver message shown to the user; topology dumps can be very long.
const MAX_DETAIL_CHARS: usize = 400;

/// Server error codes with a dedicated explanation.
mod code {
    pub const UNAUTHORIZED: i32 = 13;
    pub const AUTHENTICATION_FAILED: i32 = 18;
    pub const NAMESPACE_NOT_FOUND: i32 = 26;
    pub const NAMESPACE_EXISTS: i32 = 48;
    pub const MAX_TIME_EXPIRED: i32 = 50;
    pub const INVALID_NAMESPACE: i32 = 73;
    pub const DOCUMENT_VALIDATION_FAILURE: i32 = 121;
    pub const DUPLICATE_KEY: i32 = 11000;
}

/// Failure modes of operations on a connected server (databases, collections, documents).
#[derive(Debug, thiserror::Error)]
pub enum MongoError {
    #[error(transparent)]
    Connection(#[from] ConnectionError),
    #[error("driver error: {0}")]
    Driver(#[from] mongodb::error::Error),
    #[error(transparent)]
    Ejson(#[from] EjsonError),
    /// A query part (filter, sort, ...) could not be parsed; `field` names it for the user.
    #[error("{field}: {error}")]
    Query {
        field: &'static str,
        error: EjsonError,
    },
    #[error("{0}")]
    Invalid(String),
    /// The target (e.g. a document) does not exist.
    #[error("{0}")]
    Missing(String),
    /// The target changed since the UI loaded it.
    #[error("{0}")]
    Conflict(String),
}

impl From<MongoError> for AppError {
    fn from(error: MongoError) -> Self {
        match error {
            MongoError::Connection(error) => error.into(),
            MongoError::Driver(error) => driver_error(&error),
            MongoError::Ejson(error) => error.into(),
            MongoError::Query { field, error } => {
                let app = AppError::from(error);
                AppError {
                    message: format!("{field}: {}", app.message),
                    ..app
                }
            }
            MongoError::Invalid(message) => AppError::new(ErrorCode::InvalidInput, message),
            MongoError::Missing(message) => AppError::new(ErrorCode::NotFound, message)
                .with_hint("Reload the documents to see the current data."),
            MongoError::Conflict(message) => AppError::new(ErrorCode::Conflict, message),
        }
    }
}

/// Maps any driver error to a user-facing error with a hint.
pub fn driver_error(error: &mongodb::error::Error) -> AppError {
    let detail = shorten(&redact_uri(&error.to_string()));
    tracing::warn!(error = %detail, "MongoDB driver error");
    match error.kind.as_ref() {
        ErrorKind::Authentication { .. } => AppError::new(ErrorCode::AuthFailed, "The server rejected the credentials.")
            .with_hint("Check the user name, password and authentication database (authSource)."),
        ErrorKind::ServerSelection { .. } => AppError::new(
            ErrorCode::ConnectionFailed,
            format!("Could not reach the MongoDB server. {detail}"),
        )
        .with_hint("Check the host and port, that the server is running, firewall/VPN access, the replica set name and TLS settings."),
        ErrorKind::DnsResolve { .. } => AppError::new(ErrorCode::ConnectionFailed, format!("DNS lookup failed. {detail}"))
            .with_hint("Check the host name. For mongodb+srv:// the SRV and TXT records must exist."),
        ErrorKind::InvalidArgument { .. } | ErrorKind::InvalidTlsConfig { .. } => {
            AppError::new(ErrorCode::InvalidInput, format!("Invalid settings. {detail}"))
                .with_hint("Check the TLS files and connection options.")
        }
        ErrorKind::Io(_) | ErrorKind::ConnectionPoolCleared { .. } => {
            AppError::new(ErrorCode::ConnectionFailed, format!("The connection to the server was lost. {detail}"))
                .with_hint("Check your network and try again; reconnect if the problem persists.")
        }
        ErrorKind::Command(command) => server_error(command.code, &command.message),
        ErrorKind::Write(WriteFailure::WriteError(write)) => server_error(write.code, &write.message),
        ErrorKind::InsertMany(insert) => match insert.write_errors.as_ref().and_then(|e| e.first()) {
            Some(first) => server_error(first.code, &first.message),
            None => AppError::new(ErrorCode::OperationFailed, format!("The insert failed. {detail}")),
        },
        _ => AppError::new(ErrorCode::OperationFailed, format!("The operation failed. {detail}")),
    }
}

fn server_error(code: i32, message: &str) -> AppError {
    let message = shorten(&redact_uri(message));
    match code {
        code::UNAUTHORIZED | code::AUTHENTICATION_FAILED => {
            AppError::new(ErrorCode::Forbidden, format!("Not allowed: {message}"))
                .with_hint("Your database user lacks the required role. Ask an administrator for access.")
        }
        code::NAMESPACE_NOT_FOUND => AppError::new(ErrorCode::NotFound, format!("Not found: {message}"))
            .with_hint("It may have been dropped or renamed. Refresh the sidebar."),
        code::NAMESPACE_EXISTS => AppError::new(ErrorCode::InvalidInput, format!("Already exists: {message}"))
            .with_hint("Choose a different name."),
        code::INVALID_NAMESPACE => AppError::new(ErrorCode::InvalidInput, format!("Invalid name: {message}"))
            .with_hint("Names cannot be empty or contain '$', '\\0', and database names cannot contain '/\\. \"'."),
        code::MAX_TIME_EXPIRED => AppError::new(ErrorCode::Timeout, "The operation took longer than the time limit (maxTimeMS).")
            .with_hint("Narrow the filter, add an index, or raise maxTimeMS."),
        code::DUPLICATE_KEY => AppError::new(ErrorCode::InvalidInput, format!("Duplicate key: {message}"))
            .with_hint("A document with the same value for a unique index already exists."),
        code::DOCUMENT_VALIDATION_FAILURE => {
            AppError::new(ErrorCode::InvalidInput, "The document does not match the collection's validation rules.")
                .with_hint("Check the collection's validator and fix the highlighted fields.")
        }
        _ => AppError::new(ErrorCode::OperationFailed, message),
    }
}

fn shorten(text: &str) -> String {
    if text.chars().count() <= MAX_DETAIL_CHARS {
        return text.to_owned();
    }
    let truncated: String = text.chars().take(MAX_DETAIL_CHARS).collect();
    format!("{truncated}…")
}
