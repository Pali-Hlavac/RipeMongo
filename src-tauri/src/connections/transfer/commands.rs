//! Tauri boundary for connection import/export. Paths come from the native file dialogs.

use std::path::Path;

use tauri::State;

use super::{inspect_connections_file as inspect, read_file, write_file};
use super::{ConnectionsFileInfo, ImportSummary};
use crate::connections::ConnectionManager;
use crate::error::CommandResult;

/// Writes the selected connections to `path`; with a password, secrets are encrypted in.
#[tauri::command]
#[specta::specta]
pub async fn export_connections(
    manager: State<'_, ConnectionManager>,
    path: String,
    connection_ids: Vec<String>,
    password: Option<String>,
) -> CommandResult<()> {
    let contents = manager.export_connections(&connection_ids, password.as_deref())?;
    Ok(write_file(Path::new(&path), &contents)?)
}

/// Reports how many connections a file holds and whether it carries encrypted secrets.
#[tauri::command]
#[specta::specta]
pub async fn inspect_connections_file(path: String) -> CommandResult<ConnectionsFileInfo> {
    Ok(inspect(&read_file(Path::new(&path))?)?)
}

/// Imports every connection in `path` as new connections.
#[tauri::command]
#[specta::specta]
pub async fn import_connections(
    manager: State<'_, ConnectionManager>,
    path: String,
    password: Option<String>,
) -> CommandResult<ImportSummary> {
    let contents = read_file(Path::new(&path))?;
    Ok(manager.import_connections(&contents, password.as_deref())?)
}
