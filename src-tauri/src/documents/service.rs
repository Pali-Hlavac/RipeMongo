//! Paged queries on a driver collection, independent of Tauri. See ADR 0011.

use std::time::Duration;

use futures_util::TryStreamExt;
use mongodb::bson::{self, Document};
use mongodb::options::{Collation, CountOptions, EstimatedDocumentCountOptions, FindOptions};
use mongodb::Database;

use super::{DocumentCount, FindPage, FindRequest};
use crate::ejson;
use crate::mongo::{require_name, MongoError};

/// Largest page a single request may load; keeps memory and IPC payloads bounded.
pub const MAX_PAGE_SIZE: u32 = 1000;

/// Parses one query part, naming it in the error ("Filter: Expected …").
pub(crate) fn query_part(text: &str, field: &'static str) -> Result<Document, MongoError> {
    ejson::parse_document(text).map_err(|error| MongoError::Query { field, error })
}

fn collation(text: &str) -> Result<Option<Collation>, MongoError> {
    let document = query_part(text, "Collation")?;
    if document.is_empty() {
        return Ok(None);
    }
    bson::from_document(document)
        .map(Some)
        .map_err(|error| MongoError::Invalid(format!("Collation: {error}")))
}

fn max_time(max_time_ms: Option<u32>) -> Option<Duration> {
    max_time_ms.map(|ms| Duration::from_millis(u64::from(ms)))
}

/// Loads one page. Asks for one extra document to know whether another page follows,
/// so paging never needs a count.
pub async fn find_documents(
    database: &Database,
    collection: &str,
    request: &FindRequest,
) -> Result<FindPage, MongoError> {
    require_name(collection, "collection")?;
    if request.limit == 0 || request.limit > MAX_PAGE_SIZE {
        return Err(MongoError::Invalid(format!(
            "The page size must be between 1 and {MAX_PAGE_SIZE}."
        )));
    }
    let filter = query_part(&request.filter, "Filter")?;
    let projection = query_part(&request.projection, "Projection")?;
    let sort = query_part(&request.sort, "Sort")?;
    let collation = collation(&request.collation)?;

    let mut options = FindOptions::default();
    options.projection = (!projection.is_empty()).then_some(projection);
    options.sort = (!sort.is_empty()).then_some(sort);
    options.collation = collation;
    options.skip = Some(u64::from(request.skip));
    options.limit = Some(i64::from(request.limit) + 1);
    options.max_time = max_time(request.max_time_ms);
    let mut cursor = database
        .collection::<Document>(collection)
        .find(filter)
        .with_options(options)
        .await?;

    let page_size = usize::try_from(request.limit).unwrap_or(usize::MAX);
    let mut documents = Vec::with_capacity(page_size);
    let mut has_more = false;
    while let Some(document) = cursor.try_next().await? {
        if documents.len() == page_size {
            has_more = true;
            break;
        }
        documents.push(ejson::to_canonical_json(document));
    }
    Ok(FindPage {
        documents,
        has_more,
    })
}

/// Counts matching documents. An empty filter uses the fast metadata estimate, falling
/// back to an exact count where estimates are unsupported (e.g. views).
pub async fn count_documents(
    database: &Database,
    collection: &str,
    filter: &str,
    max_time_ms: Option<u32>,
) -> Result<DocumentCount, MongoError> {
    require_name(collection, "collection")?;
    let filter = query_part(filter, "Filter")?;
    let handle = database.collection::<Document>(collection);
    if filter.is_empty() {
        let mut options = EstimatedDocumentCountOptions::default();
        options.max_time = max_time(max_time_ms);
        if let Ok(count) = handle
            .estimated_document_count()
            .with_options(options)
            .await
        {
            return Ok(DocumentCount {
                count: as_f64(count),
                estimated: true,
            });
        }
    }
    let mut options = CountOptions::default();
    options.max_time = max_time(max_time_ms);
    let count = handle.count_documents(filter).with_options(options).await?;
    Ok(DocumentCount {
        count: as_f64(count),
        estimated: false,
    })
}

/// Counts beyond 2^53 lose precision; no real collection gets there.
#[allow(clippy::cast_precision_loss)]
fn as_f64(count: u64) -> f64 {
    count as f64
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn query_errors_name_the_part() {
        let error = query_part("{ a: ", "Sort").unwrap_err();
        assert!(error.to_string().starts_with("Sort: "), "{error}");
    }

    #[test]
    fn blank_collation_means_none() {
        assert!(collation("  ").unwrap().is_none());
        let parsed = collation("{ locale: 'en', strength: 2 }").unwrap().unwrap();
        assert_eq!(parsed.locale, "en");
    }

    #[test]
    fn invalid_collation_is_rejected() {
        assert!(collation("{ strength: 2 }").is_err());
    }
}
