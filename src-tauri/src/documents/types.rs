//! Document query model shared with the frontend.

use serde::{Deserialize, Serialize};
use specta::Type;

/// One page of a `find`. Query parts are text in JSON, Extended JSON or shell syntax;
/// blank parts mean "none".
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct FindRequest {
    pub filter: String,
    pub projection: String,
    pub sort: String,
    /// e.g. `{ locale: "en", strength: 2 }`.
    pub collation: String,
    pub skip: u32,
    /// Page size, 1 to `MAX_PAGE_SIZE` (1000).
    pub limit: u32,
    /// Server-side time limit; `None` means no limit.
    pub max_time_ms: Option<u32>,
}

/// A page of documents.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct FindPage {
    /// Each document as canonical Extended JSON (lossless; field order kept).
    pub documents: Vec<String>,
    /// Whether at least one more document follows this page.
    pub has_more: bool,
}

/// Result of counting the documents matching a filter.
#[derive(Debug, Clone, PartialEq, Serialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct DocumentCount {
    pub count: f64,
    /// `true` when taken from collection metadata (fast, may be slightly off).
    pub estimated: bool,
}

/// An inline edit of one field. Values are shell syntax / Extended JSON; `original_value`
/// guards against overwriting a change made since the document was loaded.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct FieldEdit {
    /// `_id` of the document as canonical Extended JSON.
    pub id: String,
    /// Dotted path, e.g. `address.city` or `tags.0`.
    pub path: String,
    pub original_value: String,
    pub value: String,
}
