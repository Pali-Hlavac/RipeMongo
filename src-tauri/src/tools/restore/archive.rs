//! Reads the prelude of a `mongodump --archive` file: a magic number, a header document and
//! one document per collection (`db`, `collection`, `metadata` as JSON text), ended by a
//! `0xFFFFFFFF` terminator. Only the prelude is read, never the data behind it.

use std::io::Read;

use mongodb::bson::Document;

use super::DumpNamespace;
use crate::tools::ToolsError;

/// First four bytes of every archive (little endian).
const ARCHIVE_MAGIC: u32 = 0x8199_e26d;
/// The length field that ends the prelude.
const TERMINATOR: i32 = -1;
/// The prelude entry that stands for the oplog of an `--oplog` dump.
const OPLOG_COLLECTION: &str = "oplog";
/// Upper bound on prelude entries; real dumps have far fewer collections.
const MAX_ENTRIES: usize = 100_000;

fn not_an_archive() -> ToolsError {
    ToolsError::Invalid("This file is not an archive made by mongodump.".into())
}

/// Collections of the archive and whether it contains an oplog.
pub fn read_archive_prelude(
    mut reader: impl Read,
) -> Result<(Vec<DumpNamespace>, bool), ToolsError> {
    let mut word = [0; 4];
    reader.read_exact(&mut word).map_err(|_| not_an_archive())?;
    if u32::from_le_bytes(word) != ARCHIVE_MAGIC {
        return Err(not_an_archive());
    }
    // The header (versions); its contents are not needed.
    read_document(&mut reader)?.ok_or_else(not_an_archive)?;

    let mut namespaces = Vec::new();
    let mut oplog = false;
    for _ in 0..MAX_ENTRIES {
        let Some(entry) = read_document(&mut reader)? else {
            return Ok((namespaces, oplog));
        };
        let database = entry.get_str("db").unwrap_or_default();
        let collection = entry.get_str("collection").unwrap_or_default();
        if database.is_empty() && collection == OPLOG_COLLECTION {
            oplog = true;
        } else if !database.is_empty() && !collection.is_empty() {
            let view = entry
                .get_str("metadata")
                .is_ok_and(|metadata| metadata.contains(r#""type":"view""#));
            namespaces.push(DumpNamespace {
                database: database.to_owned(),
                collection: collection.to_owned(),
                view,
                // The prelude's `size` is always 0; archives give no sizes up front.
                size: 0.0,
            });
        }
    }
    Err(not_an_archive())
}

/// The next BSON document, or `None` at the terminator.
fn read_document(reader: &mut impl Read) -> Result<Option<Document>, ToolsError> {
    let mut length = [0; 4];
    reader
        .read_exact(&mut length)
        .map_err(|_| not_an_archive())?;
    if i32::from_le_bytes(length) == TERMINATOR {
        return Ok(None);
    }
    // `from_reader` expects the length prefix too.
    let document =
        Document::from_reader(length.as_slice().chain(reader)).map_err(|_| not_an_archive())?;
    Ok(Some(document))
}

#[cfg(test)]
mod tests {
    use mongodb::bson::doc;

    use super::*;

    fn bytes(document: &Document) -> Vec<u8> {
        let mut out = Vec::new();
        document.to_writer(&mut out).unwrap();
        out
    }

    fn archive(entries: &[Document]) -> Vec<u8> {
        let mut out = ARCHIVE_MAGIC.to_le_bytes().to_vec();
        out.extend(bytes(
            &doc! { "version": "0.1", "tool_version": "100.19.1" },
        ));
        for entry in entries {
            out.extend(bytes(entry));
        }
        out.extend(TERMINATOR.to_le_bytes());
        out.extend(b"collection data that is never read");
        out
    }

    #[test]
    fn lists_collections_views_and_the_oplog() {
        let data = archive(&[
            doc! { "db": "shop", "collection": "items", "metadata": r#"{"type":"collection"}"#, "size": 0 },
            doc! { "db": "shop", "collection": "cheap", "metadata": r#"{"type":"view"}"#, "size": 0 },
            doc! { "db": "", "collection": "oplog", "metadata": "", "size": 0 },
        ]);
        let (namespaces, oplog) = read_archive_prelude(data.as_slice()).unwrap();
        assert!(oplog);
        assert_eq!(namespaces.len(), 2);
        assert_eq!(namespaces[0].collection, "items");
        assert!(!namespaces[0].view);
        assert!(namespaces[1].view);
    }

    #[test]
    fn rejects_other_files() {
        assert!(read_archive_prelude(&b"PK\x03\x04 a zip file"[..]).is_err());
        assert!(read_archive_prelude(&b""[..]).is_err());
        let mut cut = archive(&[]);
        cut.truncate(10);
        assert!(read_archive_prelude(cut.as_slice()).is_err());
    }
}
