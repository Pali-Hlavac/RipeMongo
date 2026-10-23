//! What to dump and where: the request from the dump dialog (arguments in `args.rs`).

use serde::{Deserialize, Serialize};
use specta::Type;

/// Where `mongodump` writes.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, Type)]
#[serde(
    tag = "kind",
    rename_all = "camelCase",
    rename_all_fields = "camelCase"
)]
pub enum DumpOutput {
    /// A folder with one sub-folder per database (`--out`).
    Folder { path: String },
    /// A single archive file (`--archive`).
    Archive { path: String },
}

impl DumpOutput {
    pub fn path(&self) -> &str {
        match self {
            DumpOutput::Folder { path } | DumpOutput::Archive { path } => path,
        }
    }
}

/// A dump of the whole server, one database, or one collection, with its options.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct DumpRequest {
    pub database: Option<String>,
    /// Requires `database`.
    pub collection: Option<String>,
    pub output: DumpOutput,
    /// Compress with gzip (`--gzip`).
    pub gzip: bool,
    /// Filter in JSON, Extended JSON or shell syntax (`--query`); collection dumps only.
    pub query: Option<String>,
    /// Point-in-time snapshot (`--oplog`); whole-server dumps of a replica set only.
    pub oplog: bool,
    /// Collections left out (`--excludeCollection`); database dumps only.
    pub exclude_collections: Vec<String>,
    /// Name prefixes left out (`--excludeCollectionsWithPrefix`); database dumps only.
    pub exclude_prefixes: Vec<String>,
    /// Collections dumped at the same time (`--numParallelCollections`); `None` keeps the
    /// tool's default.
    pub parallel_collections: Option<u32>,
}

impl DumpRequest {
    /// A dump with no options beyond scope and destination.
    pub fn new(database: Option<String>, collection: Option<String>, output: DumpOutput) -> Self {
        Self {
            database,
            collection,
            output,
            gzip: false,
            query: None,
            oplog: false,
            exclude_collections: Vec::new(),
            exclude_prefixes: Vec::new(),
            parallel_collections: None,
        }
    }

    /// "Dump shop.orders", "Dump shop" or "Dump all databases".
    pub fn title(&self) -> String {
        match (&self.database, &self.collection) {
            (Some(database), Some(collection)) => format!("Dump {database}.{collection}"),
            (Some(database), None) => format!("Dump {database}"),
            _ => "Dump all databases".to_owned(),
        }
    }

    /// True when the exclusions leave this collection out of the dump.
    pub fn leaves_out(&self, collection: &str) -> bool {
        self.excluded_collections().any(|name| name == collection)
            || self
                .excluded_prefixes()
                .any(|prefix| collection.starts_with(prefix))
    }

    pub(super) fn excluded_collections(&self) -> impl Iterator<Item = &str> {
        non_empty_items(&self.exclude_collections)
    }

    pub(super) fn excluded_prefixes(&self) -> impl Iterator<Item = &str> {
        non_empty_items(&self.exclude_prefixes)
    }
}

fn non_empty_items(items: &[String]) -> impl Iterator<Item = &str> {
    items
        .iter()
        .map(|item| item.trim())
        .filter(|item| !item.is_empty())
}
