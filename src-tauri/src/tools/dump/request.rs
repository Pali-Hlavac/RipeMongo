//! What to dump and where: the request from the dump dialog and its `mongodump` arguments.

use std::path::Path;

use serde::{Deserialize, Serialize};
use specta::Type;

use crate::tools::ToolsError;

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

/// A dump of the whole server, one database, or one collection.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct DumpRequest {
    pub database: Option<String>,
    /// Requires `database`.
    pub collection: Option<String>,
    pub output: DumpOutput,
    /// Compress with gzip (`--gzip`).
    pub gzip: bool,
}

impl DumpRequest {
    /// "Dump shop.orders", "Dump shop" or "Dump all databases".
    pub fn title(&self) -> String {
        match (&self.database, &self.collection) {
            (Some(database), Some(collection)) => format!("Dump {database}.{collection}"),
            (Some(database), None) => format!("Dump {database}"),
            _ => "Dump all databases".to_owned(),
        }
    }

    /// `mongodump` arguments (without the connection).
    pub fn args(&self) -> Result<Vec<String>, ToolsError> {
        let database = non_empty(self.database.as_deref());
        let collection = non_empty(self.collection.as_deref());
        if collection.is_some() && database.is_none() {
            return Err(ToolsError::Invalid(
                "Choose the database of the collection.".into(),
            ));
        }
        let path = self.output.path().trim();
        if path.is_empty() || !Path::new(path).is_absolute() {
            return Err(ToolsError::Invalid(
                "Choose where to save the dump (a full path).".into(),
            ));
        }

        let mut args = Vec::new();
        if let Some(database) = database {
            args.push(format!("--db={database}"));
        }
        if let Some(collection) = collection {
            args.push(format!("--collection={collection}"));
        }
        args.push(match self.output {
            DumpOutput::Folder { .. } => format!("--out={path}"),
            DumpOutput::Archive { .. } => format!("--archive={path}"),
        });
        if self.gzip {
            args.push("--gzip".into());
        }
        Ok(args)
    }
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

    fn request(
        database: Option<&str>,
        collection: Option<&str>,
        output: DumpOutput,
    ) -> DumpRequest {
        DumpRequest {
            database: database.map(Into::into),
            collection: collection.map(Into::into),
            output,
            gzip: false,
        }
    }

    #[test]
    fn builds_arguments_for_each_scope() {
        let folder = absolute("dump");
        let collection = request(
            Some("shop"),
            Some("orders"),
            DumpOutput::Folder {
                path: folder.clone(),
            },
        );
        assert_eq!(collection.title(), "Dump shop.orders");
        assert_eq!(
            collection.args().unwrap(),
            vec![
                "--db=shop".to_owned(),
                "--collection=orders".to_owned(),
                format!("--out={folder}"),
            ]
        );

        let archive = absolute("all.archive");
        let mut server = request(
            None,
            None,
            DumpOutput::Archive {
                path: archive.clone(),
            },
        );
        server.gzip = true;
        assert_eq!(server.title(), "Dump all databases");
        assert_eq!(
            server.args().unwrap(),
            vec![format!("--archive={archive}"), "--gzip".to_owned()]
        );
    }

    #[test]
    fn rejects_incomplete_requests() {
        let folder = DumpOutput::Folder {
            path: absolute("dump"),
        };
        assert!(request(None, Some("orders"), folder).args().is_err());
        let relative = DumpOutput::Folder {
            path: "dump".into(),
        };
        assert!(request(Some("shop"), None, relative).args().is_err());
        let empty = DumpOutput::Archive { path: " ".into() };
        assert!(request(Some("shop"), None, empty).args().is_err());
    }
}
