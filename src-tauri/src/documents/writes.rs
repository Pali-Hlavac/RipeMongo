//! Document writes: insert, replace, set one field, delete. Edits are guarded by an
//! optimistic check so a change made by someone else since loading is never overwritten.

use mongodb::bson::{doc, Bson, Document};
use mongodb::Collection;

use super::service::query_part;
use super::FieldEdit;
use crate::ejson;
use crate::mongo::{require_name, MongoError};

/// Upper bound on documents per insert, so one paste cannot flood the server or the UI.
pub const MAX_INSERT_DOCUMENTS: usize = 10_000;

const CHANGED: &str =
    "The document was changed or deleted since it was loaded. Reload it and try again.";

fn collection(
    database: &mongodb::Database,
    name: &str,
) -> Result<Collection<Document>, MongoError> {
    require_name(name, "collection")?;
    Ok(database.collection::<Document>(name))
}

/// Parses the `_id` sent by the UI (canonical Extended JSON of the value).
fn parse_id(id: &str) -> Result<Bson, MongoError> {
    ejson::parse_value(id).map_err(|error| MongoError::Query {
        field: "_id",
        error,
    })
}

/// Inserts one document or an array of documents; returns how many were inserted.
pub async fn insert_documents(
    database: &mongodb::Database,
    collection_name: &str,
    text: &str,
) -> Result<u32, MongoError> {
    let handle = collection(database, collection_name)?;
    if text.trim().is_empty() {
        return Err(MongoError::Invalid("Type a document to insert.".into()));
    }
    let documents = ejson::parse_documents(text).map_err(|error| MongoError::Query {
        field: "Document",
        error,
    })?;
    if documents.is_empty() {
        return Err(MongoError::Invalid(
            "The array has no documents to insert.".into(),
        ));
    }
    if documents.len() > MAX_INSERT_DOCUMENTS {
        return Err(MongoError::Invalid(format!(
            "At most {MAX_INSERT_DOCUMENTS} documents can be inserted at once. Use Import for more."
        )));
    }
    let result = handle.insert_many(documents).await?;
    Ok(u32::try_from(result.inserted_ids.len()).unwrap_or(u32::MAX))
}

/// Replaces a document with the edited text. `original` is the canonical JSON the UI loaded;
/// if the stored document differs, nothing is written and `Conflict` is returned.
pub async fn replace_document(
    database: &mongodb::Database,
    collection_name: &str,
    id: &str,
    original: &str,
    text: &str,
) -> Result<(), MongoError> {
    let handle = collection(database, collection_name)?;
    let id = parse_id(id)?;
    let mut replacement = query_part(text, "Document")?;
    match replacement.get("_id") {
        None => {
            // Keep `_id` first, as MongoDB stores it.
            let mut with_id = doc! { "_id": id.clone() };
            with_id.extend(replacement);
            replacement = with_id;
        }
        Some(edited) if *edited != id => {
            return Err(MongoError::Invalid(
                "The _id of a document cannot be changed. Clone the document instead.".into(),
            ));
        }
        Some(_) => {}
    }
    let current = handle.find_one(doc! { "_id": id.clone() }).await?;
    if current.map(ejson::to_canonical_json).as_deref() != Some(original) {
        return Err(MongoError::Conflict(CHANGED.into()));
    }
    let result = handle.replace_one(doc! { "_id": id }, replacement).await?;
    if result.matched_count == 0 {
        return Err(MongoError::Conflict(CHANGED.into()));
    }
    Ok(())
}

/// Sets one field (dotted path) to a new value, only if it still holds the original value.
pub async fn set_field(
    database: &mongodb::Database,
    collection_name: &str,
    edit: &FieldEdit,
) -> Result<(), MongoError> {
    let handle = collection(database, collection_name)?;
    let path = edit.path.as_str();
    if path.is_empty() || path == "_id" || path.starts_with("_id.") {
        return Err(MongoError::Invalid(
            "The _id of a document cannot be changed.".into(),
        ));
    }
    let id = parse_id(&edit.id)?;
    let original = ejson::parse_value(&edit.original_value).map_err(|error| MongoError::Query {
        field: "Original value",
        error,
    })?;
    let value = ejson::parse_value(&edit.value).map_err(|error| MongoError::Query {
        field: "Value",
        error,
    })?;
    let result = handle
        .update_one(
            doc! { "_id": id, path: original },
            doc! { "$set": { path: value } },
        )
        .await?;
    if result.matched_count == 0 {
        return Err(MongoError::Conflict(CHANGED.into()));
    }
    Ok(())
}

/// Deletes one document by `_id`.
pub async fn delete_document(
    database: &mongodb::Database,
    collection_name: &str,
    id: &str,
) -> Result<(), MongoError> {
    let handle = collection(database, collection_name)?;
    let result = handle.delete_one(doc! { "_id": parse_id(id)? }).await?;
    if result.deleted_count == 0 {
        return Err(MongoError::Missing(
            "The document no longer exists; it may have been deleted already.".into(),
        ));
    }
    Ok(())
}
