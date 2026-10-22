//! Import and export of saved connections as a JSON file. Secrets are either left out or
//! encrypted with a user-chosen password (ADR 0008). Imported connections get new ids so
//! existing ones are never overwritten.

pub mod commands;
mod crypto;
mod error;

use std::collections::HashMap;
use std::path::Path;

use serde::{Deserialize, Serialize};
use specta::Type;

pub use error::TransferError;

use super::{
    validate_profile, ConnectionError, ConnectionManager, ConnectionProfile, ConnectionSecrets,
};
use crypto::EncryptedBlob;

const FORMAT: &str = "ripemongo-connections";
const FORMAT_VERSION: u32 = 1;
/// Refuse to read anything bigger; real exports are a few KB.
const MAX_FILE_BYTES: u64 = 10 * 1024 * 1024;

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct ConnectionsFile {
    format: String,
    version: u32,
    connections: Vec<ConnectionProfile>,
    secrets: Option<EncryptedBlob>,
}

/// What a connections file contains, shown before importing.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct ConnectionsFileInfo {
    pub connection_count: u32,
    pub has_encrypted_secrets: bool,
}

/// Result of an import.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct ImportSummary {
    pub imported: u32,
    pub secrets_imported: bool,
}

type Result<T> = std::result::Result<T, TransferError>;

impl ConnectionManager {
    /// Serializes the given connections; with a password, their secrets are encrypted in.
    pub fn export_connections(&self, ids: &[String], password: Option<&str>) -> Result<String> {
        let connections: Vec<_> = self
            .list()?
            .into_iter()
            .filter(|profile| ids.contains(&profile.id))
            .collect();
        let secrets = match password {
            Some(password) => {
                let map = connections
                    .iter()
                    .map(|p| Ok((p.id.clone(), self.load_secrets(&p.id)?)))
                    .collect::<Result<HashMap<_, _>>>()?;
                let plaintext = serde_json::to_vec(&map).map_err(|_| TransferError::Crypto)?;
                Some(crypto::encrypt(&plaintext, password)?)
            }
            None => None,
        };
        let file = ConnectionsFile {
            format: FORMAT.into(),
            version: FORMAT_VERSION,
            connections,
            secrets,
        };
        serde_json::to_string_pretty(&file).map_err(|_| TransferError::Crypto)
    }

    /// Imports every connection from `raw`. Secrets are restored only with the password.
    pub fn import_connections(&self, raw: &str, password: Option<&str>) -> Result<ImportSummary> {
        let file = parse_file(raw)?;
        let secrets: HashMap<String, ConnectionSecrets> = match (&file.secrets, password) {
            (Some(blob), Some(password)) => {
                serde_json::from_slice(&crypto::decrypt(blob, password)?)
                    .map_err(|_| TransferError::InvalidFile("invalid secrets payload".into()))?
            }
            _ => HashMap::new(),
        };
        for profile in &file.connections {
            validate_profile(profile).map_err(|reason| {
                TransferError::InvalidFile(format!("connection \"{}\": {reason}", profile.name))
            })?;
        }
        let imported = u32::try_from(file.connections.len()).unwrap_or(u32::MAX);
        for profile in file.connections {
            let original_id = profile.id.clone();
            let saved = self.save_imported(ConnectionProfile {
                id: String::new(),
                ..profile
            })?;
            if let Some(profile_secrets) = secrets.get(&original_id) {
                self.store_secrets(&saved.id, profile_secrets)?;
            }
        }
        Ok(ImportSummary {
            imported,
            secrets_imported: !secrets.is_empty(),
        })
    }
}

/// Describes a connections file without importing it.
pub fn inspect_connections_file(raw: &str) -> Result<ConnectionsFileInfo> {
    let file = parse_file(raw)?;
    Ok(ConnectionsFileInfo {
        connection_count: u32::try_from(file.connections.len()).unwrap_or(u32::MAX),
        has_encrypted_secrets: file.secrets.is_some(),
    })
}

/// Reads a connections file, refusing oversized files.
pub fn read_file(path: &Path) -> Result<String> {
    let io_error = |source| TransferError::Io {
        path: path.to_path_buf(),
        source,
    };
    let size = std::fs::metadata(path).map_err(io_error)?.len();
    if size > MAX_FILE_BYTES {
        return Err(TransferError::TooLarge(size));
    }
    std::fs::read_to_string(path).map_err(io_error)
}

/// Writes an export file.
pub fn write_file(path: &Path, contents: &str) -> Result<()> {
    std::fs::write(path, contents).map_err(|source| TransferError::Io {
        path: path.to_path_buf(),
        source,
    })
}

fn parse_file(raw: &str) -> Result<ConnectionsFile> {
    let file: ConnectionsFile =
        serde_json::from_str(raw).map_err(|error| TransferError::InvalidFile(error.to_string()))?;
    if file.format != FORMAT {
        return Err(TransferError::InvalidFile(format!(
            "unexpected format {}",
            file.format
        )));
    }
    if file.version > FORMAT_VERSION {
        return Err(TransferError::UnsupportedVersion(file.version));
    }
    Ok(file)
}

impl From<crate::secrets::SecretsError> for TransferError {
    fn from(error: crate::secrets::SecretsError) -> Self {
        Self::Connection(ConnectionError::Secrets(error))
    }
}

#[cfg(test)]
mod tests;
