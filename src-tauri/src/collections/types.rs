//! Collection data model shared with the frontend.

use serde::{Deserialize, Serialize};
use specta::Type;

/// What kind of namespace a collection entry is.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Type)]
#[serde(rename_all = "camelCase")]
pub enum CollectionKind {
    Collection,
    View,
    Timeseries,
}

/// A collection or view as listed in the sidebar.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct CollectionInfo {
    pub name: String,
    pub kind: CollectionKind,
    /// Source collection of a view.
    pub view_on: Option<String>,
    pub capped: bool,
    pub read_only: bool,
}

/// Size information from `$collStats` (summed over shards). Floats because JS numbers
/// cannot represent every 64-bit integer.
#[derive(Debug, Clone, PartialEq, Serialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct CollectionStats {
    pub document_count: f64,
    /// Uncompressed data size in bytes.
    pub size: f64,
    pub storage_size: f64,
    pub index_size: f64,
    pub average_document_size: f64,
}

/// Bucketing hint for time-series collections.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub enum TimeSeriesGranularity {
    Seconds,
    Minutes,
    Hours,
}

/// Options for a new collection.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, Type)]
#[serde(
    tag = "kind",
    rename_all = "camelCase",
    rename_all_fields = "camelCase"
)]
pub enum NewCollectionOptions {
    Standard,
    /// Fixed-size collection that overwrites its oldest documents.
    Capped {
        size_bytes: f64,
        max_documents: Option<f64>,
    },
    TimeSeries {
        time_field: String,
        meta_field: Option<String>,
        granularity: Option<TimeSeriesGranularity>,
        /// Documents are deleted automatically after this many seconds.
        expire_after_seconds: Option<f64>,
    },
}

/// A new read-only view defined by an aggregation pipeline.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct NewView {
    pub name: String,
    pub view_on: String,
    /// Pipeline as JSON / shell syntax, e.g. `[{ $match: { active: true } }]`.
    pub pipeline: String,
}
