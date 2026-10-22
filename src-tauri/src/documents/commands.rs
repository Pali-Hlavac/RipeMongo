//! Tauri boundary for reading documents.

use tauri::State;

use super::{DocumentCount, FieldEdit, FindPage, FindRequest};
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
