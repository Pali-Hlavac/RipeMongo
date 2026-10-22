//! Bulk writes by filter: update many and delete many, each with a preview first.
//!
//! An update preview applies the update to a few matching documents inside a transaction
//! that is always aborted, so "after" is exactly what the server would store. Standalone
//! servers have no transactions; their preview shows the matching documents only.

use futures_util::TryStreamExt;
use mongodb::bson::{doc, Bson, Document};
use mongodb::options::UpdateModifications;
use mongodb::{Collection, Database};

use super::service::{as_f64, count_documents, query_part};
use super::{DeletePreview, UpdatePreview, UpdateSample, UpdateSummary};
use crate::ejson;
use crate::mongo::{require_name, MongoError};

/// Documents shown in a preview.
pub const PREVIEW_SAMPLES: i64 = 3;
/// Time limit for counting the matching documents of a preview.
const PREVIEW_COUNT_MAX_TIME_MS: u32 = 30_000;

/// Parses an update: a document of `$` operators, or an aggregation pipeline (array).
pub(crate) fn parse_update(text: &str) -> Result<UpdateModifications, MongoError> {
    if text.trim().is_empty() {
        return Err(MongoError::Invalid(
            "Type an update, e.g. { $set: { status: \"archived\" } }.".into(),
        ));
    }
    let value = ejson::parse_value(text).map_err(|error| MongoError::Query {
        field: "Update",
        error,
    })?;
    match value {
        Bson::Document(update) => {
            if update.is_empty() || update.keys().any(|key| !key.starts_with('$')) {
                return Err(MongoError::Invalid(
                    "Update: use update operators such as { $set: { … } } or { $unset: { … } }. \
                     To replace a whole document, edit it instead."
                        .into(),
                ));
            }
            Ok(UpdateModifications::Document(update))
        }
        Bson::Array(stages) if !stages.is_empty() => stages
            .into_iter()
            .map(|stage| match stage {
                Bson::Document(stage) => Ok(stage),
                _ => Err(MongoError::Invalid(
                    "Update: each pipeline stage must be a document, e.g. { $set: { … } }.".into(),
                )),
            })
            .collect::<Result<Vec<_>, _>>()
            .map(UpdateModifications::Pipeline),
        _ => Err(MongoError::Invalid(
            "Update: expected a document of update operators or a pipeline array.".into(),
        )),
    }
}

fn collection(database: &Database, name: &str) -> Result<Collection<Document>, MongoError> {
    require_name(name, "collection")?;
    Ok(database.collection::<Document>(name))
}

/// The first `PREVIEW_SAMPLES` documents matching `filter`.
async fn samples(
    handle: &Collection<Document>,
    filter: Document,
) -> Result<Vec<Document>, MongoError> {
    let cursor = handle.find(filter).limit(PREVIEW_SAMPLES).await?;
    Ok(cursor.try_collect().await?)
}

/// Replica sets and sharded clusters support the transactions an exact preview needs.
async fn supports_transactions(database: &Database) -> Result<bool, MongoError> {
    let hello = database
        .client()
        .database("admin")
        .run_command(doc! { "hello": 1 })
        .await?;
    Ok(hello.contains_key("setName") || hello.get_str("msg") == Ok("isdbgrid"))
}

/// Applies `update` to the given documents in a transaction, reads them back, and aborts.
async fn simulate(
    database: &Database,
    handle: &Collection<Document>,
    ids: Vec<Bson>,
    update: UpdateModifications,
) -> Result<Vec<Document>, MongoError> {
    let mut session = database.client().start_session().await?;
    session.start_transaction().await?;
    let filter = doc! { "_id": { "$in": ids } };
    let outcome = async {
        handle
            .update_many(filter.clone(), update)
            .session(&mut session)
            .await?;
        let mut cursor = handle.find(filter).session(&mut session).await?;
        let mut documents = Vec::new();
        while let Some(document) = cursor.next(&mut session).await {
            documents.push(document?);
        }
        Ok::<_, MongoError>(documents)
    }
    .await;
    // Never commit: the preview must not change anything, also when it failed.
    let _ = session.abort_transaction().await;
    outcome
}

/// Counts the documents `filter` matches and shows a few before and (where possible) after.
pub async fn preview_update_many(
    database: &Database,
    collection_name: &str,
    filter: &str,
    update: &str,
) -> Result<UpdatePreview, MongoError> {
    let handle = collection(database, collection_name)?;
    let parsed_filter = query_part(filter, "Filter")?;
    let update = parse_update(update)?;
    let matched = count_documents(
        database,
        collection_name,
        filter,
        Some(PREVIEW_COUNT_MAX_TIME_MS),
    )
    .await?;
    let before = samples(&handle, parsed_filter).await?;
    let simulated = supports_transactions(database).await?;
    let after = if simulated && !before.is_empty() {
        let ids = before
            .iter()
            .filter_map(|d| d.get("_id").cloned())
            .collect();
        simulate(database, &handle, ids, update).await?
    } else {
        Vec::new()
    };
    let samples = before
        .into_iter()
        .map(|document| {
            let after = document.get("_id").and_then(|id| {
                after
                    .iter()
                    .find(|candidate| candidate.get("_id") == Some(id))
                    .cloned()
                    .map(ejson::to_canonical_json)
            });
            UpdateSample {
                before: ejson::to_canonical_json(document),
                after,
            }
        })
        .collect();
    Ok(UpdatePreview {
        matched,
        samples,
        simulated,
    })
}

/// Applies `update` to every document matching `filter`.
pub async fn update_many(
    database: &Database,
    collection_name: &str,
    filter: &str,
    update: &str,
) -> Result<UpdateSummary, MongoError> {
    let handle = collection(database, collection_name)?;
    let filter = query_part(filter, "Filter")?;
    let result = handle.update_many(filter, parse_update(update)?).await?;
    Ok(UpdateSummary {
        matched: as_f64(result.matched_count),
        modified: as_f64(result.modified_count),
    })
}

/// Counts the documents `filter` matches and shows the first few.
pub async fn preview_delete_many(
    database: &Database,
    collection_name: &str,
    filter: &str,
) -> Result<DeletePreview, MongoError> {
    let handle = collection(database, collection_name)?;
    let parsed_filter = query_part(filter, "Filter")?;
    let matched = count_documents(
        database,
        collection_name,
        filter,
        Some(PREVIEW_COUNT_MAX_TIME_MS),
    )
    .await?;
    let samples = samples(&handle, parsed_filter)
        .await?
        .into_iter()
        .map(ejson::to_canonical_json)
        .collect();
    Ok(DeletePreview { matched, samples })
}

/// Deletes every document matching `filter`; returns how many were deleted.
pub async fn delete_many(
    database: &Database,
    collection_name: &str,
    filter: &str,
) -> Result<f64, MongoError> {
    let handle = collection(database, collection_name)?;
    let filter = query_part(filter, "Filter")?;
    let result = handle.delete_many(filter).await?;
    Ok(as_f64(result.deleted_count))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn accepts_operators_and_pipelines() {
        assert!(matches!(
            parse_update("{ $set: { a: 1 }, $unset: { b: '' } }").unwrap(),
            UpdateModifications::Document(_)
        ));
        assert!(matches!(
            parse_update("[{ $set: { total: { $add: ['$a', '$b'] } } }]").unwrap(),
            UpdateModifications::Pipeline(stages) if stages.len() == 1
        ));
    }

    #[test]
    fn rejects_replacements_and_empty_updates() {
        for text in [
            "",
            "{}",
            "{ a: 1 }",
            "{ $set: { a: 1 }, b: 2 }",
            "[]",
            "[1]",
            "5",
        ] {
            assert!(parse_update(text).is_err(), "{text}");
        }
    }

    #[test]
    fn names_the_update_in_parse_errors() {
        let error = parse_update("{ $set: ").unwrap_err();
        assert!(error.to_string().starts_with("Update: "), "{error}");
    }
}
