//! Tauri boundary for reading and writing documents.

use tauri::State;

use super::{
    DeletePreview, DocumentCount, FieldEdit, FieldSample, FindPage, FindRequest, UpdatePreview,
    UpdateSummary,
};
use crate::connections::ConnectionManager;
use crate::error::CommandResult;
use crate::mongo;

/// One page of documents matching a query.
#[tauri::command]
#[specta::specta]
pub async fn find_documents(
    manager: State<'_, ConnectionManager>,
    connection_id: String,
    database: String,
    collection: String,
    request: FindRequest,
) -> CommandResult<FindPage> {
    let db = mongo::database(&manager, &connection_id, &database).await?;
    Ok(super::find_documents(&db, &collection, &request).await?)
}

/// Number of documents matching a filter (estimated when the filter is empty).
#[tauri::command]
#[specta::specta]
pub async fn count_documents(
    manager: State<'_, ConnectionManager>,
    connection_id: String,
    database: String,
    collection: String,
    filter: String,
    max_time_ms: Option<u32>,
) -> CommandResult<DocumentCount> {
    let db = mongo::database(&manager, &connection_id, &database).await?;
    Ok(super::count_documents(&db, &collection, &filter, max_time_ms).await?)
}

/// Field names and dotted paths found in a random sample of documents.
#[tauri::command]
#[specta::specta]
pub async fn sample_fields(
    manager: State<'_, ConnectionManager>,
    connection_id: String,
    database: String,
    collection: String,
) -> CommandResult<FieldSample> {
    let db = mongo::database(&manager, &connection_id, &database).await?;
    Ok(super::sample_fields(&db, &collection).await?)
}

/// Inserts one document or an array of documents; returns how many were inserted.
#[tauri::command]
#[specta::specta]
pub async fn insert_documents(
    manager: State<'_, ConnectionManager>,
    connection_id: String,
    database: String,
    collection: String,
    text: String,
) -> CommandResult<u32> {
    let db = mongo::database(&manager, &connection_id, &database).await?;
    Ok(super::insert_documents(&db, &collection, &text).await?)
}

/// Replaces a document with edited text, unless it changed since `original` was loaded.
#[tauri::command]
#[specta::specta]
pub async fn replace_document(
    manager: State<'_, ConnectionManager>,
    connection_id: String,
    database: String,
    collection: String,
    id: String,
    original: String,
    text: String,
) -> CommandResult<()> {
    let db = mongo::database(&manager, &connection_id, &database).await?;
    Ok(super::replace_document(&db, &collection, &id, &original, &text).await?)
}

/// Sets one field of a document, unless its value changed since it was loaded.
#[tauri::command]
#[specta::specta]
pub async fn set_document_field(
    manager: State<'_, ConnectionManager>,
    connection_id: String,
    database: String,
    collection: String,
    edit: FieldEdit,
) -> CommandResult<()> {
    let db = mongo::database(&manager, &connection_id, &database).await?;
    Ok(super::set_field(&db, &collection, &edit).await?)
}

/// Deletes one document by `_id`.
#[tauri::command]
#[specta::specta]
pub async fn delete_document(
    manager: State<'_, ConnectionManager>,
    connection_id: String,
    database: String,
    collection: String,
    id: String,
) -> CommandResult<()> {
    let db = mongo::database(&manager, &connection_id, &database).await?;
    Ok(super::delete_document(&db, &collection, &id).await?)
}

/// Counts what `update_many` would change and shows a few documents before and after.
#[tauri::command]
#[specta::specta]
pub async fn preview_update_many(
    manager: State<'_, ConnectionManager>,
    connection_id: String,
    database: String,
    collection: String,
    filter: String,
    update: String,
) -> CommandResult<UpdatePreview> {
    let db = mongo::database(&manager, &connection_id, &database).await?;
    Ok(super::preview_update_many(&db, &collection, &filter, &update).await?)
}

/// Applies an update (operators or pipeline) to every document matching the filter.
#[tauri::command]
#[specta::specta]
pub async fn update_many(
    manager: State<'_, ConnectionManager>,
    connection_id: String,
    database: String,
    collection: String,
    filter: String,
    update: String,
) -> CommandResult<UpdateSummary> {
    let db = mongo::database(&manager, &connection_id, &database).await?;
    Ok(super::update_many(&db, &collection, &filter, &update).await?)
}

/// Counts what `delete_many` would delete and shows the first few documents.
#[tauri::command]
#[specta::specta]
pub async fn preview_delete_many(
    manager: State<'_, ConnectionManager>,
    connection_id: String,
    database: String,
    collection: String,
    filter: String,
) -> CommandResult<DeletePreview> {
    let db = mongo::database(&manager, &connection_id, &database).await?;
    Ok(super::preview_delete_many(&db, &collection, &filter).await?)
}

/// Deletes every document matching the filter; returns how many were deleted.
#[tauri::command]
#[specta::specta]
pub async fn delete_many(
    manager: State<'_, ConnectionManager>,
    connection_id: String,
    database: String,
    collection: String,
    filter: String,
) -> CommandResult<f64> {
    let db = mongo::database(&manager, &connection_id, &database).await?;
    Ok(super::delete_many(&db, &collection, &filter).await?)
}
