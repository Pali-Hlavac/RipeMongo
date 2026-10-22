//! Tauri boundary for query history and favorites.

use tauri::State;

use super::{CollectionQueries, Namespace, QueryHistory, QueryParts};
use crate::error::CommandResult;

fn namespace<'a>(connection_id: &'a str, database: &'a str, collection: &'a str) -> Namespace<'a> {
    Namespace {
        connection_id,
        database,
        collection,
    }
}

/// Recent and favorite queries of a collection.
#[tauri::command]
#[specta::specta]
pub async fn list_queries(
    store: State<'_, QueryHistory>,
    connection_id: String,
    database: String,
    collection: String,
) -> CommandResult<CollectionQueries> {
    Ok(store.list(namespace(&connection_id, &database, &collection))?)
}

/// Remembers a query that ran successfully.
#[tauri::command]
#[specta::specta]
pub async fn record_query(
    store: State<'_, QueryHistory>,
    connection_id: String,
    database: String,
    collection: String,
    query: QueryParts,
) -> CommandResult<CollectionQueries> {
    Ok(store.record(namespace(&connection_id, &database, &collection), query)?)
}

/// Saves (or replaces, by name) a favorite query.
#[tauri::command]
#[specta::specta]
pub async fn save_favorite_query(
    store: State<'_, QueryHistory>,
    connection_id: String,
    database: String,
    collection: String,
    name: String,
    query: QueryParts,
) -> CommandResult<CollectionQueries> {
    Ok(store.save_favorite(
        namespace(&connection_id, &database, &collection),
        &name,
        query,
    )?)
}

/// Deletes a favorite query.
#[tauri::command]
#[specta::specta]
pub async fn delete_favorite_query(
    store: State<'_, QueryHistory>,
    connection_id: String,
    database: String,
    collection: String,
    id: String,
) -> CommandResult<CollectionQueries> {
    Ok(store.delete_favorite(namespace(&connection_id, &database, &collection), &id)?)
}
