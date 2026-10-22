//! Tauri boundary for reading documents.

use tauri::State;

use super::{DocumentCount, FindPage, FindRequest};
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
