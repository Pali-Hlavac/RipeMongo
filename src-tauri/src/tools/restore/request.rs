//! What to restore and how: the request from the restore dialog and its `mongorestore`
//! arguments.

use std::path::Path;

use serde::{Deserialize, Serialize};
use specta::Type;

use super::RestoreSource;
use crate::tools::dump::MAX_PARALLEL_COLLECTIONS;
use crate::tools::ToolsError;

/// Characters a database name cannot contain (MongoDB's rules, Windows included).
const FORBIDDEN_DATABASE_CHARS: &str = "/\\. \"$*<>:|?";
/// Longest database name MongoDB accepts, in bytes.
const MAX_DATABASE_NAME_BYTES: usize = 63;

/// Restore one database of the dump under another name.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct DatabaseRename {
    pub from: String,
    pub to: String,
}

/// A restore of a dump into the connection's server.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct RestoreRequest {
    pub source: RestoreSource,
    /// Namespaces of the dump (`db.collection`) to leave out (`--nsExclude`).
    pub exclude: Vec<String>,
    /// Databases restored under another name (`--nsFrom`/`--nsTo`).
    pub renames: Vec<DatabaseRename>,
    /// Drop each restored collection first (`--drop`).
    pub drop: bool,
    /// Only check what would be restored (`--dryRun`).
    pub dry_run: bool,
    /// Replay the dump's oplog (`--oplogReplay`); needs a full restore.
    pub oplog_replay: bool,
    /// `--numParallelCollections`; `None` keeps the tool's default.
    pub parallel_collections: Option<u32>,
}

impl RestoreRequest {
    /// "Restore C:\dumps\nightly" (the last part of the path).
    pub fn title(&self) -> String {
        let path = self.source.path().trim();
        let name = Path::new(path).file_name().map_or_else(
            || path.to_owned(),
            |name| name.to_string_lossy().into_owned(),
        );
        let verb = if self.dry_run {
            "Check restore of"
        } else {
            "Restore"
        };
        format!("{verb} {name}")
    }

    /// Database renames that change something.
    pub fn effective_renames(&self) -> impl Iterator<Item = (&str, &str)> {
        self.renames
            .iter()
            .map(|rename| (rename.from.trim(), rename.to.trim()))
            .filter(|(from, to)| !from.is_empty() && from != to)
    }

    /// `mongorestore` arguments (without the connection). `gzip` comes from the dump itself.
    pub fn args(&self, gzip: bool) -> Result<Vec<String>, ToolsError> {
        let path = self.source.path().trim();
        if path.is_empty() || !Path::new(path).is_absolute() {
            return Err(invalid("Choose the dump to restore (a full path)."));
        }
        for (_, to) in self.effective_renames() {
            check_database_name(to)?;
        }
        let excludes: Vec<&str> = self
            .exclude
            .iter()
            .map(|ns| ns.trim())
            .filter(|ns| !ns.is_empty())
            .collect();
        let renames = self.effective_renames().count();
        if self.oplog_replay && (!excludes.is_empty() || renames > 0) {
            return Err(invalid(
                "Replaying the oplog needs a full restore: include everything and keep the \
                 database names.",
            ));
        }
        if let Some(parallel) = self.parallel_collections {
            if !(1..=MAX_PARALLEL_COLLECTIONS).contains(&parallel) {
                return Err(invalid(&format!(
                    "Restore between 1 and {MAX_PARALLEL_COLLECTIONS} collections at a time."
                )));
            }
        }

        let mut args = vec![match self.source {
            RestoreSource::Folder { .. } => format!("--dir={path}"),
            RestoreSource::Archive { .. } => format!("--archive={path}"),
        }];
        if gzip {
            args.push("--gzip".into());
        }
        args.extend(
            excludes
                .iter()
                .map(|ns| format!("--nsExclude={}", escape(ns))),
        );
        for (from, to) in self.effective_renames() {
            args.push(format!("--nsFrom={}.*", escape(from)));
            args.push(format!("--nsTo={}.*", escape(to)));
        }
        if self.drop {
            args.push("--drop".into());
        }
        if self.oplog_replay {
            args.push("--oplogReplay".into());
        }
        if let Some(parallel) = self.parallel_collections {
            args.push(format!("--numParallelCollections={parallel}"));
        }
        if self.dry_run {
            // Verbose output lists what a dry run would restore.
            args.extend(["--dryRun".to_owned(), "--verbose=1".to_owned()]);
        }
        Ok(args)
    }
}

fn invalid(message: &str) -> ToolsError {
    ToolsError::Invalid(message.to_owned())
}

fn check_database_name(name: &str) -> Result<(), ToolsError> {
    if name.is_empty() {
        return Err(invalid("Enter the new database name."));
    }
    if name.len() > MAX_DATABASE_NAME_BYTES
        || name
            .chars()
            .any(|c| FORBIDDEN_DATABASE_CHARS.contains(c) || c == '\0')
    {
        return Err(invalid(&format!(
            "“{name}” cannot be a database name: use at most {MAX_DATABASE_NAME_BYTES} \
             characters, without spaces or any of / \\ . \" $ * < > : | ?"
        )));
    }
    Ok(())
}

/// Namespace patterns treat `*` as a wildcard and `$` as a variable; `\` escapes both.
fn escape(name: &str) -> String {
    let mut escaped = String::with_capacity(name.len());
    for c in name.chars() {
        if matches!(c, '\\' | '*' | '$') {
            escaped.push('\\');
        }
        escaped.push(c);
    }
    escaped
}
