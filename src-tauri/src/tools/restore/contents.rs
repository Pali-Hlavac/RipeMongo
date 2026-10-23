//! What a dump contains, read before restoring: its databases and collections, whether it is
//! gzip-compressed and whether it holds an oplog (`mongodump --oplog`).

use std::fs::File;
use std::io::{BufReader, Read};
use std::path::Path;

use serde::{Deserialize, Serialize};
use specta::Type;

use super::archive::read_archive_prelude;
use crate::tools::ToolsError;

/// The first two bytes of every gzip stream.
const GZIP_MAGIC: [u8; 2] = [0x1f, 0x8b];
const GZ_SUFFIX: &str = ".gz";
const BSON_SUFFIX: &str = ".bson";
const METADATA_SUFFIX: &str = ".metadata.json";
/// The oplog file at the top of an `--oplog` folder dump.
const OPLOG_FILE: &str = "oplog";
/// mongorestore never restores this collection, so it is not offered.
const SKIPPED_NAMESPACE: (&str, &str) = ("admin", "system.version");

/// Where a dump to restore is.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, Type)]
#[serde(
    tag = "kind",
    rename_all = "camelCase",
    rename_all_fields = "camelCase"
)]
pub enum RestoreSource {
    /// A dump folder with one sub-folder per database (`--dir`).
    Folder { path: String },
    /// A single archive file (`--archive`).
    Archive { path: String },
}

impl RestoreSource {
    pub fn path(&self) -> &str {
        match self {
            RestoreSource::Folder { path } | RestoreSource::Archive { path } => path,
        }
    }
}

/// One collection or view in a dump.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct DumpNamespace {
    pub database: String,
    pub collection: String,
    /// Views have a definition but no documents.
    pub view: bool,
    /// Bytes of the data file in a folder dump (compressed if gzip); 0 when unknown (archives).
    pub size: f64,
}

/// What a dump holds.
#[derive(Debug, Clone, Default, PartialEq, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct DumpContents {
    /// Compressed with `--gzip`; mongorestore needs `--gzip` too.
    pub gzip: bool,
    /// Made with `--oplog`; can be replayed for a point-in-time restore.
    pub oplog: bool,
    /// Sorted by database, then collection.
    pub namespaces: Vec<DumpNamespace>,
}

/// Reads what a dump contains. Blocking: call it off the async runtime.
pub fn inspect_dump(source: &RestoreSource) -> Result<DumpContents, ToolsError> {
    let path = Path::new(source.path().trim());
    if !path.is_absolute() {
        return Err(ToolsError::Invalid(
            "Choose the dump to restore (a full path).".into(),
        ));
    }
    let mut contents = match source {
        RestoreSource::Folder { .. } => inspect_folder(path)?,
        RestoreSource::Archive { .. } => inspect_archive(path)?,
    };
    contents
        .namespaces
        .retain(|ns| (ns.database.as_str(), ns.collection.as_str()) != SKIPPED_NAMESPACE);
    contents
        .namespaces
        .sort_by(|a, b| (&a.database, &a.collection).cmp(&(&b.database, &b.collection)));
    contents
        .namespaces
        .dedup_by(|a, b| a.database == b.database && a.collection == b.collection);
    Ok(contents)
}

fn unreadable(path: &Path, error: &std::io::Error) -> ToolsError {
    ToolsError::Invalid(format!("Could not read {}: {error}", path.display()))
}

fn inspect_archive(path: &Path) -> Result<DumpContents, ToolsError> {
    let mut file = File::open(path).map_err(|error| unreadable(path, &error))?;
    let mut magic = [0; 2];
    let gzip = file.read_exact(&mut magic).is_ok() && magic == GZIP_MAGIC;
    let file = File::open(path).map_err(|error| unreadable(path, &error))?;
    let reader: Box<dyn Read> = if gzip {
        Box::new(flate2::read::GzDecoder::new(BufReader::new(file)))
    } else {
        Box::new(BufReader::new(file))
    };
    let (namespaces, oplog) = read_archive_prelude(reader)?;
    Ok(DumpContents {
        gzip,
        oplog,
        namespaces,
    })
}

fn inspect_folder(path: &Path) -> Result<DumpContents, ToolsError> {
    let entries = std::fs::read_dir(path).map_err(|error| unreadable(path, &error))?;
    let mut contents = DumpContents::default();
    let mut loose_files = false;
    for entry in entries.flatten() {
        let name = entry.file_name().to_string_lossy().into_owned();
        if entry.path().is_dir() {
            read_database_folder(&entry.path(), &name, &mut contents)?;
        } else if let Some((stem, gzip)) = strip_suffix(&name, BSON_SUFFIX) {
            if stem == OPLOG_FILE {
                contents.oplog = true;
                contents.gzip |= gzip;
            } else {
                loose_files = true;
            }
        }
    }
    if contents.namespaces.is_empty() {
        let message = if loose_files {
            "This looks like the folder of one database. Choose the folder above it (the one that \
             contains the database folders)."
        } else {
            "This folder does not contain a dump made by mongodump."
        };
        return Err(ToolsError::Invalid(message.into()));
    }
    Ok(contents)
}

fn read_database_folder(
    path: &Path,
    database: &str,
    contents: &mut DumpContents,
) -> Result<(), ToolsError> {
    let entries = std::fs::read_dir(path).map_err(|error| unreadable(path, &error))?;
    let mut data = Vec::new();
    let mut metadata = Vec::new();
    for entry in entries.flatten() {
        let name = entry.file_name().to_string_lossy().into_owned();
        if let Some((collection, gzip)) = strip_suffix(&name, BSON_SUFFIX) {
            contents.gzip |= gzip;
            // File sizes fit an f64 exactly far beyond any real dump.
            #[allow(clippy::cast_precision_loss)]
            let size = entry.metadata().map_or(0.0, |meta| meta.len() as f64);
            data.push((collection.to_owned(), size));
        } else if let Some((collection, gzip)) = strip_suffix(&name, METADATA_SUFFIX) {
            contents.gzip |= gzip;
            metadata.push(collection.to_owned());
        }
    }
    // A view is dumped as its definition (metadata) without a data file.
    let views: Vec<String> = metadata
        .into_iter()
        .filter(|name| !data.iter().any(|(collection, _)| collection == name))
        .collect();
    let namespaces = data
        .into_iter()
        .map(|(collection, size)| (collection, false, size))
        .chain(views.into_iter().map(|collection| (collection, true, 0.0)));
    contents
        .namespaces
        .extend(namespaces.map(|(collection, view, size)| DumpNamespace {
            database: database.to_owned(),
            collection,
            view,
            size,
        }));
    Ok(())
}

/// `items.bson.gz` with `.bson` → `("items", true)`.
fn strip_suffix<'a>(name: &'a str, suffix: &str) -> Option<(&'a str, bool)> {
    match name.strip_suffix(GZ_SUFFIX) {
        Some(plain) => plain.strip_suffix(suffix).map(|stem| (stem, true)),
        None => name.strip_suffix(suffix).map(|stem| (stem, false)),
    }
}
