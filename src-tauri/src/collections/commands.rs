//! Tauri boundary for collection and view operations.

use tauri::State;

use super::{CollectionInfo, CollectionStats, NewCollectionOptions, NewView};
use crate::connections::ConnectionManager;
use crate::error::CommandResult;
use crate::mongo;

/// Collections and views of a database.
#[tauri::command]
#[specta::specta]
pub async fn list_collections(
    manager: State<'_, ConnectionManager>,
    connection_id: String,
    database: String,
) -> CommandResult<Vec<CollectionInfo>> {
    let db = mongo::database(&manager, &connection_id, &database).await?;
    Ok(super::list_collections(&db).await?)
}

/// Document count and sizes of one collection.
#[tauri::command]
#[specta::specta]
pub async fn collection_stats(
    manager: State<'_, ConnectionManager>,
    connection_id: String,
    database: String,
    collection: String,
) -> CommandResult<CollectionStats> {
    let db = mongo::database(&manager, &connection_id, &database).await?;
    Ok(super::collection_stats(&db, &collection).await?)
}

/// Creates a standard, capped or time-series collection.
#[tauri::command]
#[specta::specta]
pub async fn create_collection(
    manager: State<'_, ConnectionManager>,
    connection_id: String,
    database: String,
    collection: String,
    options: NewCollectionOptions,
) -> CommandResult<()> {
    let db = mongo::database(&manager, &connection_id, &database).await?;
    Ok(super::create_collection(&db, &collection, &options).await?)
}

/// Creates a view from an aggregation pipeline.
#[tauri::command]
#[specta::specta]
pub async fn create_view(
    manager: State<'_, ConnectionManager>,
    connection_id: String,
    database: String,
    view: NewView,
) -> CommandResult<()> {
    let db = mongo::database(&manager, &connection_id, &database).await?;
    Ok(super::create_view(&db, &view).await?)
}

/// Drops a collection or view. The UI requires typing the name before calling this.
#[tauri::command]
#[specta::specta]
pub async fn drop_collection(
    manager: State<'_, ConnectionManager>,
    connection_id: String,
    database: String,
    collection: String,
) -> CommandResult<()> {
    let db = mongo::database(&manager, &connection_id, &database).await?;
    Ok(super::drop_collection(&db, &collection).await?)
}

/// Renames a collection within its database.
#[tauri::command]
#[specta::specta]
pub async fn rename_collection(
    manager: State<'_, ConnectionManager>,
    connection_id: String,
    database: String,
    collection: String,
    new_name: String,
) -> CommandResult<()> {
    let db = mongo::database(&manager, &connection_id, &database).await?;
    Ok(super::rename_collection(&db, &collection, &new_name).await?)
}
