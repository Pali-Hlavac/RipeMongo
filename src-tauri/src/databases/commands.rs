//! Tauri boundary for database operations.

use tauri::State;

use super::DatabaseInfo;
use crate::connections::ConnectionManager;
use crate::error::CommandResult;
use crate::mongo;

/// Databases of a connected connection, sorted by name.
#[tauri::command]
#[specta::specta]
pub async fn list_databases(
    manager: State<'_, ConnectionManager>,
    connection_id: String,
) -> CommandResult<Vec<DatabaseInfo>> {
    let client = mongo::client(&manager, &connection_id).await?;
    Ok(super::list_databases(&client).await?)
}

/// Creates a database together with its first collection.
#[tauri::command]
#[specta::specta]
pub async fn create_database(
    manager: State<'_, ConnectionManager>,
    connection_id: String,
    database: String,
    collection: String,
) -> CommandResult<()> {
    let client = mongo::client(&manager, &connection_id).await?;
    Ok(super::create_database(&client, &database, &collection).await?)
}

/// Drops a database. The UI requires typing the name before calling this.
#[tauri::command]
#[specta::specta]
pub async fn drop_database(
    manager: State<'_, ConnectionManager>,
    connection_id: String,
    database: String,
) -> CommandResult<()> {
    let client = mongo::client(&manager, &connection_id).await?;
    Ok(super::drop_database(&client, &database).await?)
}
