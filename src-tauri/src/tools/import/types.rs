//! Choices of an import request: file format, what happens to existing documents, CSV type
//! errors and columns.

use serde::{Deserialize, Serialize};
use specta::Type;

use super::ColumnType;

/// Format of the file to import.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub enum ImportFormat {
    /// One JSON document per line (or concatenated documents).
    Json,
    /// One JSON array of documents (`--jsonArray`).
    JsonArray,
    /// Delimited text (comma, semicolon, tab, …), read by RipeMongo and passed on as CSV.
    Csv,
}

/// What happens to documents that match existing ones.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub enum ImportMode {
    /// Insert only; documents whose `_id` exists fail and are counted.
    Insert,
    /// Replace matching documents, insert the rest.
    Upsert,
    /// Update fields of matching documents, insert the rest.
    Merge,
}

/// What mongoimport does when a CSV value does not fit its column type (`--parseGrace`).
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub enum ParseErrors {
    /// Stop the import.
    Stop,
    /// Leave the field out of that document.
    SkipField,
    /// Leave the whole row out.
    SkipRow,
    /// Import the value as if the column type were automatic.
    AutoCast,
}

/// One column of a CSV file.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct ImportColumn {
    /// Imported or left out.
    pub include: bool,
    /// Field name in the documents; dots create nested documents (`address.city`).
    pub field: String,
    #[serde(rename = "type")]
    pub kind: ColumnType,
    /// Date layout for [`ColumnType::Date`], e.g. `dd.MM.yyyy`.
    pub date_format: String,
}
