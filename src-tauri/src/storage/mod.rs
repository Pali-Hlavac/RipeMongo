//! Shared persistence helpers for JSON documents in the app-config directory.

mod error;
mod json_file;

pub use error::StorageError;
pub use json_file::JsonFile;
