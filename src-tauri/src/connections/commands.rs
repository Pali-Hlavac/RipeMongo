//! Tauri boundary for connections. Thin wrappers around [`ConnectionManager`].

use tauri::State;

use super::uri::ParsedConnectionString;
use super::uri::{build_connection_string as build_uri, parse_connection_string as parse_uri};
use super::{
    ActiveConnectionInfo, ConnectionConfig, ConnectionError, ConnectionManager, ConnectionProfile,
    SecretUpdates, ServerInfo, StoredSecrets,
};
use crate::dump_profiles::DumpProfiles;
use crate::error::CommandResult;
use crate::query_history::QueryHistory;

/// All saved connections.
#[tauri::command]
#[specta::specta]
pub async fn list_connections(
    manager: State<'_, ConnectionManager>,
) -> CommandResult<Vec<ConnectionProfile>> {
    Ok(manager.list()?)
}

/// Creates (empty `id`) or updates a connection and its keychain secrets.
#[tauri::command]
#[specta::specta]
pub async fn save_connection(
    manager: State<'_, ConnectionManager>,
    profile: ConnectionProfile,
    secrets: SecretUpdates,
) -> CommandResult<ConnectionProfile> {
    Ok(manager.save(profile, &secrets)?)
}

/// Deletes a connection, its secrets, saved queries and saved dumps, and closes it if
/// connected.
#[tauri::command]
#[specta::specta]
pub async fn delete_connection(
    manager: State<'_, ConnectionManager>,
    history: State<'_, QueryHistory>,
    dumps: State<'_, DumpProfiles>,
    connection_id: String,
) -> CommandResult<()> {
    manager.delete(&connection_id).await?;
    // The connection is gone either way; leftovers are never shown, so only log.
    if let Err(error) = history.forget_connection(&connection_id) {
        tracing::warn!(%error, "could not remove the query history of a deleted connection");
    }
    if let Err(error) = dumps.forget_connection(&connection_id) {
        tracing::warn!(%error, "could not remove the saved dumps of a deleted connection");
    }
    Ok(())
}

/// Copies a connection (including secrets) as "<name> (copy)".
#[tauri::command]
#[specta::specta]
pub async fn duplicate_connection(
    manager: State<'_, ConnectionManager>,
    connection_id: String,
) -> CommandResult<ConnectionProfile> {
    Ok(manager.duplicate(&connection_id)?)
}

/// Which secrets are stored for a connection. Secret values never leave the backend.
#[tauri::command]
#[specta::specta]
pub async fn get_stored_secrets(
    manager: State<'_, ConnectionManager>,
    connection_id: String,
) -> CommandResult<StoredSecrets> {
    Ok(manager.stored_secrets(&connection_id)?)
}

/// Parses a connection string into structured settings plus any secrets it contained.
#[tauri::command]
#[specta::specta]
pub fn parse_connection_string(uri: String) -> CommandResult<ParsedConnectionString> {
    Ok(parse_uri(&uri).map_err(ConnectionError::from)?)
}

/// Renders settings as a connection string without secrets (safe to display).
#[tauri::command]
#[specta::specta]
pub fn build_connection_string(config: ConnectionConfig) -> String {
    build_uri(&config, None)
}

/// Tries unsaved settings and reports the server. `connection_id` lets unchanged secret
/// fields fall back to the stored values of an existing connection.
#[tauri::command]
#[specta::specta]
pub async fn test_connection(
    manager: State<'_, ConnectionManager>,
    config: ConnectionConfig,
    connection_id: Option<String>,
    secrets: SecretUpdates,
) -> CommandResult<ServerInfo> {
    Ok(manager
        .test(&config, connection_id.as_deref(), &secrets)
        .await?)
}

/// Connects a saved connection (no-op if already connected).
#[tauri::command]
#[specta::specta]
pub async fn open_connection(
    manager: State<'_, ConnectionManager>,
    connection_id: String,
) -> CommandResult<ActiveConnectionInfo> {
    Ok(manager.connect(&connection_id).await?)
}

/// Disconnects a connection.
#[tauri::command]
#[specta::specta]
pub async fn close_connection(
    manager: State<'_, ConnectionManager>,
    connection_id: String,
) -> CommandResult<()> {
    manager.disconnect(&connection_id).await;
    Ok(())
}

/// All live connections.
#[tauri::command]
#[specta::specta]
pub async fn list_active_connections(
    manager: State<'_, ConnectionManager>,
) -> CommandResult<Vec<ActiveConnectionInfo>> {
    Ok(manager.active().await)
}
