//! Connection-string parse errors. Messages are shown to the user verbatim.

/// Why a connection string could not be parsed.
#[derive(Debug, Clone, PartialEq, Eq, thiserror::Error)]
pub enum UriError {
    #[error("The connection string must start with mongodb:// or mongodb+srv://.")]
    MissingScheme,
    #[error("The connection string has no host.")]
    MissingHost,
    #[error("\"{0}\" is not a valid port number.")]
    InvalidPort(String),
    #[error("A mongodb+srv:// connection string must have exactly one host name and no port.")]
    InvalidSrvHost,
    #[error("The option \"{key}\" has an invalid value \"{value}\".")]
    InvalidValue { key: String, value: String },
    #[error("The option \"{0}\" has no value (expected key=value).")]
    MissingValue(String),
    #[error("\"{0}\" contains an invalid percent-encoded sequence.")]
    InvalidEncoding(String),
    #[error("{0}")]
    Invalid(String),
    #[error("{0} is not supported yet.")]
    Unsupported(String),
}
