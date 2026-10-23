//! Saved dump model shared with the frontend, and its file format.

use serde::{Deserialize, Serialize};
use specta::Type;

use crate::tools::dump::DumpRequest;

/// A saved dump as stored on disk.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StoredDumpProfile {
    pub id: String,
    pub name: String,
    pub connection_id: String,
    pub request: DumpRequest,
    /// RFC 3339.
    pub created_at: String,
    /// RFC 3339; when it was last started.
    pub last_run_at: Option<String>,
}

/// A saved dump as listed in the app, with the current name of its connection.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct DumpProfile {
    pub id: String,
    pub name: String,
    pub connection_id: String,
    pub connection_name: String,
    pub request: DumpRequest,
    pub created_at: String,
    pub last_run_at: Option<String>,
}

impl DumpProfile {
    pub fn new(stored: StoredDumpProfile, connection_name: String) -> Self {
        Self {
            id: stored.id,
            name: stored.name,
            connection_id: stored.connection_id,
            connection_name,
            request: stored.request,
            created_at: stored.created_at,
            last_run_at: stored.last_run_at,
        }
    }
}

/// What the dump dialog saves: a new profile (`id: None`) or changes to one.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct DumpProfileInput {
    pub id: Option<String>,
    pub name: String,
    pub connection_id: String,
    pub request: DumpRequest,
}

/// Contents of the saved dumps file.
#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProfilesFile {
    pub profiles: Vec<StoredDumpProfile>,
}
