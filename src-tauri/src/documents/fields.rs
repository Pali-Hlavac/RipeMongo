//! Field names found in a random sample of a collection's documents, for choosing what an
//! export writes.

use std::collections::HashSet;
use std::time::Duration;

use futures_util::TryStreamExt;
use mongodb::bson::{doc, Bson, Document};
use mongodb::Database;
use serde::Serialize;
use specta::Type;

use crate::mongo::{require_name, MongoError};

/// Documents read to find field names.
pub const FIELD_SAMPLE_SIZE: i64 = 1000;
/// Nested documents at this depth are listed as one field instead of being expanded.
const MAX_DEPTH: usize = 4;
/// Most names listed per kind (wide, irregular collections).
const MAX_FIELDS: usize = 500;
/// Longest the server may spend sampling.
const SAMPLE_TIME_LIMIT: Duration = Duration::from_secs(10);

/// Fields of sampled documents, in the order they were first seen (`_id` first).
#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct FieldSample {
    /// Top-level field names.
    pub fields: Vec<String>,
    /// Dotted paths to values, nested documents expanded (`address.city`); an array is one
    /// value.
    pub paths: Vec<String>,
}

/// Samples up to [`FIELD_SAMPLE_SIZE`] random documents (works on views too).
pub async fn sample_fields(
    database: &Database,
    collection: &str,
) -> Result<FieldSample, MongoError> {
    require_name(collection, "collection")?;
    let mut cursor = database
        .collection::<Document>(collection)
        .aggregate([doc! { "$sample": { "size": FIELD_SAMPLE_SIZE } }])
        .max_time(SAMPLE_TIME_LIMIT)
        .await?;
    let mut collector = Collector::default();
    while let Some(document) = cursor.try_next().await? {
        collector.add(&document);
    }
    Ok(collector.sample)
}

#[derive(Default)]
struct Collector {
    sample: FieldSample,
    seen_fields: HashSet<String>,
    seen_paths: HashSet<String>,
}

impl Collector {
    fn add(&mut self, document: &Document) {
        for key in document.keys() {
            push_new(&mut self.sample.fields, &mut self.seen_fields, key);
        }
        self.add_paths(document, "", 1);
    }

    fn add_paths(&mut self, document: &Document, prefix: &str, depth: usize) {
        for (key, value) in document {
            let path = if prefix.is_empty() {
                key.clone()
            } else {
                format!("{prefix}.{key}")
            };
            match value {
                Bson::Document(nested) if depth < MAX_DEPTH && !nested.is_empty() => {
                    self.add_paths(nested, &path, depth + 1);
                }
                _ => push_new(&mut self.sample.paths, &mut self.seen_paths, &path),
            }
        }
    }
}

fn push_new(list: &mut Vec<String>, seen: &mut HashSet<String>, name: &str) {
    if list.len() < MAX_FIELDS && seen.insert(name.to_owned()) {
        list.push(name.to_owned());
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn lists_fields_and_nested_paths_in_first_seen_order() {
        let mut collector = Collector::default();
        collector
            .add(&doc! { "_id": 1, "name": "a", "address": { "city": "BA", "geo": { "lat": 1 } } });
        collector.add(&doc! { "_id": 2, "tags": ["x"], "address": "unknown", "empty": {} });
        let sample = collector.sample;
        assert_eq!(sample.fields, ["_id", "name", "address", "tags", "empty"]);
        assert_eq!(
            sample.paths,
            [
                "_id",
                "name",
                "address.city",
                "address.geo.lat",
                "tags",
                "address",
                "empty"
            ]
        );
    }

    #[test]
    fn stops_expanding_at_the_maximum_depth() {
        let mut collector = Collector::default();
        collector.add(&doc! { "a": { "b": { "c": { "d": { "e": 1 } } } } });
        assert_eq!(collector.sample.paths, ["a.b.c.d"]);
    }
}
