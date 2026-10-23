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
        let database = non_empty(self.database.as_deref());
        let collection = non_empty(self.collection.as_deref());
        if collection.is_some() && database.is_none() {
            return Err(invalid("Choose the database of the collection."));
        }
        let path = self.output.path().trim();
        if path.is_empty() || !Path::new(path).is_absolute() {
            return Err(invalid("Choose where to save the dump (a full path)."));
        }
        let query = self.query_filter()?;
        if query.is_some() && collection.is_none() {
            return Err(invalid("A query filter needs a single collection."));
        }
        if self.oplog && database.is_some() {
            return Err(invalid(
                "A point-in-time (oplog) dump covers the whole server, not one database.",
            ));
        }
        let excludes = self.excluded_collections().next().is_some()
            || self.excluded_prefixes().next().is_some();
        if excludes && (database.is_none() || collection.is_some()) {
            return Err(invalid(
                "Collections can only be left out of a database dump.",
            ));
        }
        if let Some(parallel) = self.parallel_collections {
            if !(1..=MAX_PARALLEL_COLLECTIONS).contains(&parallel) {
                return Err(invalid(&format!(
                    "Dump between 1 and {MAX_PARALLEL_COLLECTIONS} collections at a time."
                )));
            }
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

#[cfg(test)]
mod tests {
    use super::*;

    fn absolute(name: &str) -> String {
        std::env::temp_dir()
            .join(name)
            .to_string_lossy()
            .into_owned()
    }

    fn folder() -> DumpOutput {
        DumpOutput::Folder {
            path: absolute("dump"),
        }
    }

    fn request(database: Option<&str>, collection: Option<&str>) -> DumpRequest {
        DumpRequest::new(
            database.map(Into::into),
            collection.map(Into::into),
            folder(),
        )
    }

    #[test]
    fn builds_arguments_for_each_scope() {
        let collection = request(Some("shop"), Some("orders"));
        assert_eq!(collection.title(), "Dump shop.orders");
        assert_eq!(
            collection.args().unwrap(),
            vec![
                "--db=shop".to_owned(),
                "--collection=orders".to_owned(),
                format!("--out={}", absolute("dump")),
            ]
        );

        let archive = absolute("all.archive");
        let mut server = DumpRequest::new(
            None,
            None,
            DumpOutput::Archive {
                path: archive.clone(),
            },
        );
        server.gzip = true;
        server.oplog = true;
        server.parallel_collections = Some(2);
        assert_eq!(server.title(), "Dump all databases");
        assert_eq!(
            server.args().unwrap(),
            vec![
                format!("--archive={archive}"),
                "--gzip".to_owned(),
                "--oplog".to_owned(),
                "--numParallelCollections=2".to_owned(),
            ]
        );
    }

    #[test]
    fn passes_queries_as_canonical_extended_json() {
        let mut orders = request(Some("shop"), Some("orders"));
        orders.query = Some(r#"{ total: { $gt: 5 }, at: ISODate("2026-01-02T00:00:00Z") }"#.into());
        let args = orders.args().unwrap();
        assert_eq!(
            args[2],
            r#"--query={"total":{"$gt":{"$numberInt":"5"}},"at":{"$date":{"$numberLong":"1767312000000"}}}"#
        );
        orders.query = Some(" {} ".into());
        assert_eq!(orders.args().unwrap().len(), 3);
        orders.query = Some("{ total: ".into());
        let error = orders.args().unwrap_err().to_string();
        assert!(
            error.starts_with("The query filter is not valid"),
            "{error}"
        );
    }

    #[test]
    fn leaves_out_collections_and_prefixes() {
        let mut shop = request(Some("shop"), None);
        shop.exclude_collections = vec!["logs".into(), " ".into()];
        shop.exclude_prefixes = vec!["tmp_".into()];
        assert_eq!(
            shop.args().unwrap()[1..3],
            [
                "--excludeCollection=logs".to_owned(),
                "--excludeCollectionsWithPrefix=tmp_".to_owned(),
            ]
        );
        assert!(shop.leaves_out("logs"));
        assert!(shop.leaves_out("tmp_import"));
        assert!(!shop.leaves_out("orders"));
    }

    #[test]
    fn rejects_options_outside_their_scope() {
        assert!(request(None, Some("orders")).args().is_err());
        let mut relative = request(Some("shop"), None);
        relative.output = DumpOutput::Folder {
            path: "dump".into(),
        };
        assert!(relative.args().is_err());
        let mut empty = request(Some("shop"), None);
        empty.output = DumpOutput::Archive { path: " ".into() };
        assert!(empty.args().is_err());

        let mut query = request(Some("shop"), None);
        query.query = Some("{ a: 1 }".into());
        assert!(query.args().is_err());
        let mut oplog = request(Some("shop"), None);
        oplog.oplog = true;
        assert!(oplog.args().is_err());
        let mut excludes = request(Some("shop"), Some("orders"));
        excludes.exclude_prefixes = vec!["tmp_".into()];
        assert!(excludes.args().is_err());
        for parallel in [0, MAX_PARALLEL_COLLECTIONS + 1] {
            let mut server = request(None, None);
            server.parallel_collections = Some(parallel);
            assert!(server.args().is_err());
        }
    }
}
