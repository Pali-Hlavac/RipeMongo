//! What to copy and where: the request from the copy dialog and the arguments of both tools.

use serde::{Deserialize, Serialize};
use specta::Type;

use crate::tools::dump::{DumpOutput, DumpRequest};
use crate::tools::names::{check_collection_name, check_database_name, escape_namespace};
use crate::tools::ToolsError;

/// Makes the tools write the archive to standard output and read it from standard input.
const ARCHIVE_ON_PIPE: &str = "--archive";

/// A copy of a database or collection into a connection (the same one or another).
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct CopyRequest {
    pub database: String,
    /// `None` copies the whole database.
    pub collection: Option<String>,
    pub target_database: String,
    /// The collection's name in the target; collection copies only.
    pub target_collection: Option<String>,
    /// Filter in JSON, Extended JSON or shell syntax; collection copies only.
    pub query: Option<String>,
    /// Collections left out; database copies only.
    pub exclude_collections: Vec<String>,
    /// Name prefixes left out; database copies only.
    pub exclude_prefixes: Vec<String>,
    /// Create the source's indexes in the target (otherwise `--noIndexRestore`).
    pub indexes: bool,
    /// Drop each copied collection in the target first (`--drop`).
    pub drop: bool,
}

impl CopyRequest {
    /// A copy without options, keeping every name.
    pub fn new(database: &str, collection: Option<&str>) -> Self {
        Self {
            database: database.to_owned(),
            collection: collection.map(Into::into),
            target_database: database.to_owned(),
            target_collection: collection.map(Into::into),
            query: None,
            exclude_collections: Vec::new(),
            exclude_prefixes: Vec::new(),
            indexes: true,
            drop: false,
        }
    }

    /// The same selection as a dump (its output is never used).
    pub fn source(&self) -> DumpRequest {
        let mut dump = DumpRequest::new(
            Some(self.database.trim().to_owned()),
            self.collection
                .as_deref()
                .map(|name| name.trim().to_owned()),
            DumpOutput::Archive {
                path: String::new(),
            },
        );
        dump.query.clone_from(&self.query);
        dump.exclude_collections
            .clone_from(&self.exclude_collections);
        dump.exclude_prefixes.clone_from(&self.exclude_prefixes);
        dump
    }

    /// `shop` or `shop.orders`.
    pub fn source_namespace(&self) -> String {
        namespace(self.database.trim(), self.collection.as_deref())
    }

    /// `copy` or `copy.orders`.
    pub fn target_namespace(&self) -> String {
        namespace(
            self.target_database.trim(),
            self.target_collection.as_deref(),
        )
    }

    /// "Copy shop.orders to copy.orders", plus " on <connection>" for another connection.
    pub fn title(&self, target_connection: Option<&str>) -> String {
        let on = target_connection.map_or_else(String::new, |name| format!(" on {name}"));
        format!(
            "Copy {} to {}{on}",
            self.source_namespace(),
            self.target_namespace()
        )
    }

    /// `mongodump` arguments (without the connection): the selection, written to stdout.
    pub fn dump_args(&self) -> Result<Vec<String>, ToolsError> {
        if self.database.trim().is_empty() {
            return Err(invalid("Choose the database to copy."));
        }
        if self
            .collection
            .as_deref()
            .is_some_and(|name| name.trim().is_empty())
        {
            return Err(invalid("Choose the collection to copy."));
        }
        let mut args = self.source().source_args()?;
        args.push(ARCHIVE_ON_PIPE.to_owned());
        Ok(args)
    }

    /// `mongorestore` arguments (without the connection): read from stdin, renamed to the
    /// target names.
    pub fn restore_args(&self) -> Result<Vec<String>, ToolsError> {
        let database = self.database.trim();
        let target_database = self.target_database.trim();
        if target_database.is_empty() {
            return Err(invalid("Enter the target database name."));
        }
        check_database_name(target_database)?;
        let mut args = vec![ARCHIVE_ON_PIPE.to_owned()];
        match self.collection.as_deref().map(str::trim) {
            Some(collection) => {
                let target = self.target_collection.as_deref().map_or("", str::trim);
                if target.is_empty() {
                    return Err(invalid("Enter the target collection name."));
                }
                check_collection_name(target)?;
                if (database, collection) != (target_database, target) {
                    args.push(format!(
                        "--nsFrom={}.{}",
                        escape_namespace(database),
                        escape_namespace(collection)
                    ));
                    args.push(format!(
                        "--nsTo={}.{}",
                        escape_namespace(target_database),
                        escape_namespace(target)
                    ));
                }
            }
            None if database != target_database => {
                args.push(format!("--nsFrom={}.*", escape_namespace(database)));
                args.push(format!("--nsTo={}.*", escape_namespace(target_database)));
            }
            None => {}
        }
        if self.drop {
            args.push("--drop".into());
        }
        if !self.indexes {
            args.push("--noIndexRestore".into());
        }
        Ok(args)
    }
}

fn namespace(database: &str, collection: Option<&str>) -> String {
    match collection {
        Some(collection) => format!("{database}.{}", collection.trim()),
        None => database.to_owned(),
    }
}

fn invalid(message: &str) -> ToolsError {
    ToolsError::Invalid(message.to_owned())
}
