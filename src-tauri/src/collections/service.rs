//! Collection operations on a driver database handle, independent of Tauri.

use futures_util::TryStreamExt;
use mongodb::bson::{doc, Bson, Document};
use mongodb::results::CollectionType;
use mongodb::Database;

use super::options::create_options;
use super::{CollectionInfo, CollectionKind, CollectionStats, NewCollectionOptions, NewView};
use crate::ejson;
use crate::mongo::{require_name, MongoError};

/// Collections and views of a database, sorted by name; `system.*` namespaces are hidden.
pub async fn list_collections(database: &Database) -> Result<Vec<CollectionInfo>, MongoError> {
    let specs: Vec<_> = database.list_collections().await?.try_collect().await?;
    let mut collections: Vec<CollectionInfo> = specs
        .into_iter()
        .filter(|spec| !spec.name.starts_with("system."))
        .map(|spec| CollectionInfo {
            kind: match spec.collection_type {
                CollectionType::View => CollectionKind::View,
                CollectionType::Timeseries => CollectionKind::Timeseries,
                _ => CollectionKind::Collection,
            },
            view_on: spec.options.view_on,
            capped: spec.options.capped.unwrap_or(false),
            read_only: spec.info.read_only,
            name: spec.name,
        })
        .collect();
    collections.sort_by(|a, b| a.name.cmp(&b.name));
    Ok(collections)
}

/// Document count and sizes via `$collStats`. Views have no storage, so they report zeros
/// for sizes and an estimated count of their output is not attempted.
pub async fn collection_stats(
    database: &Database,
    name: &str,
) -> Result<CollectionStats, MongoError> {
    require_name(name, "collection")?;
    let collection = database.collection::<Document>(name);
    let pipeline = vec![doc! { "$collStats": { "storageStats": {} } }];
    let per_shard: Vec<Document> = collection.aggregate(pipeline).await?.try_collect().await?;
    let total = |field: &str| {
        per_shard
            .iter()
            .filter_map(|shard| shard.get_document("storageStats").ok())
            .map(|stats| number(stats.get(field)))
            .sum::<f64>()
    };
    let document_count = total("count");
    let size = total("size");
    Ok(CollectionStats {
        document_count,
        size,
        storage_size: total("storageSize"),
        index_size: total("totalIndexSize"),
        average_document_size: if document_count > 0.0 {
            size / document_count
        } else {
            0.0
        },
    })
}

/// Creates a standard, capped or time-series collection.
pub async fn create_collection(
    database: &Database,
    name: &str,
    options: &NewCollectionOptions,
) -> Result<(), MongoError> {
    require_name(name, "collection")?;
    database
        .create_collection(name)
        .with_options(create_options(options)?)
        .await?;
    Ok(())
}

/// Creates a view; the pipeline is parsed from JSON / shell syntax.
pub async fn create_view(database: &Database, view: &NewView) -> Result<(), MongoError> {
    require_name(&view.name, "view")?;
    require_name(&view.view_on, "source collection")?;
    let pipeline = if view.pipeline.trim().is_empty() {
        Vec::new()
    } else {
        ejson::parse_documents(&view.pipeline)?
    };
    database
        .create_collection(&view.name)
        .view_on(view.view_on.clone())
        .pipeline(pipeline)
        .await?;
    Ok(())
}

/// Drops a collection or view.
pub async fn drop_collection(database: &Database, name: &str) -> Result<(), MongoError> {
    require_name(name, "collection")?;
    database.collection::<Document>(name).drop().await?;
    Ok(())
}

/// Renames a collection within its database; fails if the target exists.
pub async fn rename_collection(
    database: &Database,
    from: &str,
    to: &str,
) -> Result<(), MongoError> {
    require_name(from, "collection")?;
    require_name(to, "new collection")?;
    let db = database.name();
    database
        .client()
        .database("admin")
        .run_command(doc! {
            "renameCollection": format!("{db}.{from}"),
            "to": format!("{db}.{to}"),
            "dropTarget": false,
        })
        .await?;
    Ok(())
}

/// Reads a numeric stats field of any BSON number type as `f64`.
fn number(value: Option<&Bson>) -> f64 {
    match value {
        Some(Bson::Int32(n)) => f64::from(*n),
        // Stats values stay far below 2^53, where the conversion would lose precision.
        #[allow(clippy::cast_precision_loss)]
        Some(Bson::Int64(n)) => *n as f64,
        Some(Bson::Double(n)) => *n,
        _ => 0.0,
    }
}
