//! Reads the start of a file before importing it: JSON lines, a JSON array or delimited text,
//! and for text its delimiter, columns, sample values and suggested types.

use std::fs::File;
use std::io::{BufReader, Read};
use std::path::Path;

use serde::Serialize;
use specta::Type;

use super::columns::{suggest_type, TypeSuggestion};
use super::ImportFormat;
use crate::tools::ToolsError;

/// UTF-8 byte order mark that spreadsheet programs put at the start of CSV files.
pub const BOM: &[u8] = b"\xEF\xBB\xBF";
/// Bytes read to detect the format and the delimiter.
const PEEK_BYTES: u64 = 64 * 1024;
/// Rows after the first used to suggest column types.
const TYPE_ROWS: usize = 100;
/// Values shown per column.
const SAMPLE_ROWS: usize = 3;
/// Longest sample value shown.
const MAX_SAMPLE_CHARS: usize = 60;
/// Delimiters recognized in the first line, by preference on a tie.
const DELIMITERS: [u8; 4] = [b',', b';', b'\t', b'|'];

/// What the import dialog shows about a file.
#[derive(Debug, Clone, PartialEq, Serialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct ImportPreview {
    pub format: ImportFormat,
    /// File size in bytes.
    pub size: f64,
    /// Text files: the detected (or chosen) delimiter.
    pub delimiter: String,
    /// Text files: every column found in the first rows.
    pub columns: Vec<PreviewColumn>,
}

/// One column of a delimited text file.
#[derive(Debug, Clone, PartialEq, Serialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct PreviewColumn {
    /// Value of the first row (the column name when the file has a header line).
    pub first: String,
    /// Values of the next rows.
    pub samples: Vec<String>,
    /// Type suggested from the values after the first row.
    pub suggestion: TypeSuggestion,
}

/// Reads the file's start. `delimiter` overrides the detected one. Blocking.
pub fn inspect_import_file(
    path: &str,
    delimiter: Option<&str>,
) -> Result<ImportPreview, ToolsError> {
    let path = Path::new(path.trim());
    if !path.is_absolute() {
        return Err(ToolsError::Invalid(
            "Choose the file to import (a full path).".into(),
        ));
    }
    let unreadable = |error: std::io::Error| {
        ToolsError::Invalid(format!("Could not read {}: {error}", path.display()))
    };
    let file = File::open(path).map_err(unreadable)?;
    // File sizes fit an f64 exactly far beyond any real file.
    #[allow(clippy::cast_precision_loss)]
    let size = file.metadata().map_err(unreadable)?.len() as f64;
    let mut start = Vec::new();
    file.take(PEEK_BYTES)
        .read_to_end(&mut start)
        .map_err(unreadable)?;
    let text = start.strip_prefix(BOM).unwrap_or(&start);
    let format = match text.iter().find(|byte| !byte.is_ascii_whitespace()) {
        None => return Err(ToolsError::Invalid("The file is empty.".into())),
        Some(b'[') => ImportFormat::JsonArray,
        Some(b'{') => ImportFormat::Json,
        Some(_) => ImportFormat::Csv,
    };
    if format != ImportFormat::Csv {
        return Ok(ImportPreview {
            format,
            size,
            delimiter: ",".into(),
            columns: Vec::new(),
        });
    }
    let delimiter = match delimiter.map(str::as_bytes) {
        Some([byte]) => *byte,
        Some(_) => {
            return Err(ToolsError::Invalid(
                "Choose one character that separates the values.".into(),
            ))
        }
        None => detect_delimiter(text, path),
    };
    let file = File::open(path).map_err(unreadable)?;
    let columns = read_columns(BufReader::new(file), delimiter).map_err(|error| {
        ToolsError::Invalid(format!("Could not read {}: {error}", path.display()))
    })?;
    Ok(ImportPreview {
        format,
        size,
        delimiter: char::from(delimiter).to_string(),
        columns,
    })
}

/// The candidate that appears most often in the first line (outside quotes); `.tsv` files
/// default to tabs.
fn detect_delimiter(text: &[u8], path: &Path) -> u8 {
    let line = text.split(|byte| *byte == b'\n').next().unwrap_or(text);
    let mut counts = [0usize; DELIMITERS.len()];
    let mut quoted = false;
    for byte in line {
        if *byte == b'"' {
            quoted = !quoted;
        } else if !quoted {
            if let Some(index) = DELIMITERS.iter().position(|candidate| candidate == byte) {
                counts[index] += 1;
            }
        }
    }
    let tsv = path
        .extension()
        .is_some_and(|extension| extension.eq_ignore_ascii_case("tsv"));
    match counts.iter().enumerate().max_by_key(|(index, count)| {
        // Ties go to the earlier candidate.
        (**count, DELIMITERS.len() - index)
    }) {
        Some((index, count)) if *count > 0 => DELIMITERS[index],
        _ if tsv => b'\t',
        _ => b',',
    }
}

fn read_columns(reader: impl Read, delimiter: u8) -> Result<Vec<PreviewColumn>, csv::Error> {
    let mut reader = csv::ReaderBuilder::new()
        .delimiter(delimiter)
        .has_headers(false)
        .flexible(true)
        .from_reader(reader);
    let mut rows: Vec<Vec<String>> = Vec::new();
    for record in reader.byte_records().take(TYPE_ROWS + 1) {
        let record = record?;
        rows.push(record.iter().map(text).collect());
    }
    if let Some(first) = rows.first_mut().and_then(|row| row.first_mut()) {
        if let Some(stripped) = first.strip_prefix('\u{feff}') {
            *first = stripped.to_owned();
        }
    }
    let width = rows.iter().map(Vec::len).max().unwrap_or(0);
    let cell = |row: &Vec<String>, index: usize| row.get(index).cloned().unwrap_or_default();
    Ok((0..width)
        .map(|index| PreviewColumn {
            first: rows.first().map(|row| cell(row, index)).unwrap_or_default(),
            samples: rows
                .iter()
                .skip(1)
                .take(SAMPLE_ROWS)
                .map(|row| shorten(cell(row, index)))
                .collect(),
            suggestion: suggest_type(
                rows.iter()
                    .skip(1)
                    .map(|row| row.get(index).map_or("", String::as_str)),
            ),
        })
        .collect())
}

fn text(bytes: &[u8]) -> String {
    String::from_utf8_lossy(bytes).into_owned()
}

fn shorten(value: String) -> String {
    if value.chars().count() <= MAX_SAMPLE_CHARS {
        return value;
    }
    let mut short: String = value.chars().take(MAX_SAMPLE_CHARS).collect();
    short.push('…');
    short
}
