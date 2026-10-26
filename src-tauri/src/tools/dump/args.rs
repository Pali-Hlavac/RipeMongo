//! Validates a [`DumpRequest`] and turns it into `mongodump` arguments.

use std::path::Path;

use mongodb::bson::Document;

use super::{DumpOutput, DumpRequest};
use crate::ejson;
use crate::tools::ToolsError;

/// Most collections a dump may write at the same time.
pub const MAX_PARALLEL_COLLECTIONS: u32 = 16;

impl DumpRequest {
    /// `mongodump` arguments (without the connection).
    pub fn args(&self) -> Result<Vec<String>, ToolsError> {
        let path = self.output.path().trim();
        if path.is_empty() || !Path::new(path).is_absolute() {
            return Err(invalid("Choose where to save the dump (a full path)."));
        }
        if self.oplog && non_empty(self.database.as_deref()).is_some() {
            return Err(invalid(
                "A point-in-time (oplog) dump covers the whole server, not one database.",
            ));
        }
        if let Some(parallel) = self.parallel_collections {
            if !(1..=MAX_PARALLEL_COLLECTIONS).contains(&parallel) {
                return Err(invalid(&format!(
                    "Dump between 1 and {MAX_PARALLEL_COLLECTIONS} collections at a time."
                )));
            }
        }

        let mut args = self.source_args()?;
        args.push(match self.output {
            DumpOutput::Folder { .. } => format!("--out={path}"),
            DumpOutput::Archive { .. } => format!("--archive={path}"),
        });
        if self.gzip {
            args.push("--gzip".into());
        }
        if self.oplog {
            args.push("--oplog".into());
        }
        if let Some(parallel) = self.parallel_collections {
            args.push(format!("--numParallelCollections={parallel}"));
        }
        Ok(args)
    }

    /// The arguments choosing what to dump: database, collection, query filter and the
    /// collections left out. Also used by copies, which write to standard output.
    pub(crate) fn source_args(&self) -> Result<Vec<String>, ToolsError> {
        let database = non_empty(self.database.as_deref());
        let collection = non_empty(self.collection.as_deref());
        if collection.is_some() && database.is_none() {
            return Err(invalid("Choose the database of the collection."));
        }
        let query = self.query_filter()?;
        if query.is_some() && collection.is_none() {
            return Err(invalid("A query filter needs a single collection."));
        }
        let excludes = self.excluded_collections().next().is_some()
            || self.excluded_prefixes().next().is_some();
        if excludes && (database.is_none() || collection.is_some()) {
            return Err(invalid(
                "Collections can only be left out of a database dump.",
            ));
        }

        let mut args = Vec::new();
        if let Some(database) = database {
            args.push(format!("--db={database}"));
        }
        if let Some(collection) = collection {
            args.push(format!("--collection={collection}"));
        }
        if let Some(query) = query {
            args.push(format!("--query={}", ejson::to_canonical_json(query)));
        }
        args.extend(
            self.excluded_collections()
                .map(|name| format!("--excludeCollection={name}")),
        );
        args.extend(
            self.excluded_prefixes()
                .map(|prefix| format!("--excludeCollectionsWithPrefix={prefix}")),
        );
        Ok(args)
    }

    /// The parsed query filter; `None` when blank or `{}`.
    pub fn query_filter(&self) -> Result<Option<Document>, ToolsError> {
        let Some(text) = non_empty(self.query.as_deref()) else {
            return Ok(None);
        };
        let filter = ejson::parse_document(text)
            .map_err(|error| invalid(&format!("The query filter is not valid: {error}")))?;
        Ok((!filter.is_empty()).then_some(filter))
    }
}

fn invalid(message: &str) -> ToolsError {
    ToolsError::Invalid(message.to_owned())
}

fn non_empty(value: Option<&str>) -> Option<&str> {
    value.map(str::trim).filter(|value| !value.is_empty())
}
