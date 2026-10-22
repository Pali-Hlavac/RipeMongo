//! Saved connection profiles: identity, organization metadata and the connection config.

use serde::{Deserialize, Serialize};
use specta::Type;

use super::ConnectionConfig;

/// Color label shown next to a connection (e.g. red for production).
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub enum ConnectionColor {
    Red,
    Orange,
    Amber,
    Green,
    Teal,
    Blue,
    Purple,
    Pink,
}

/// A saved connection as stored in `connections.json` (secrets live in the keychain).
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct ConnectionProfile {
    /// Stable unique id (UUID v4). Empty when the UI creates a new connection.
    pub id: String,
    pub name: String,
    /// Folder the connection is grouped under in the sidebar; `None` = top level.
    pub folder: Option<String>,
    pub favorite: bool,
    pub color: Option<ConnectionColor>,
    pub config: ConnectionConfig,
}
