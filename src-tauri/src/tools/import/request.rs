//! What to import and how: the request from the import dialog and its `mongoimport`
//! arguments.

use std::path::Path;

use serde::{Deserialize, Serialize};
use specta::Type;

use super::{ImportColumn, ImportFormat, ImportMode, ParseErrors};
use crate::tools::names::check_collection_name;
use crate::tools::ToolsError;

/// An import of one file into one collection.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct ImportRequest {
    pub database: String,
    /// Created by the import when it does not exist.
    pub collection: String,
    /// Absolute path of the file.
    pub path: String,
    pub format: ImportFormat,
    /// CSV: the single character between values.
    pub delimiter: String,
    /// CSV: the first line holds column names and is not imported.
    pub header: bool,
    /// CSV: every column of the file, in order.
    pub columns: Vec<ImportColumn>,
    /// CSV: leave out fields whose value is empty (`--ignoreBlanks`).
    pub ignore_blanks: bool,
    /// CSV: values that do not fit their column type.
    pub parse_errors: ParseErrors,
    pub mode: ImportMode,
    /// Fields that identify a matching document for upsert/merge; empty means `_id`.
    pub match_fields: Vec<String>,
    /// Drop the collection first (`--drop`).
    pub drop: bool,
    /// Stop at the first document that fails (`--stopOnError`).
    pub stop_on_error: bool,
    /// Documents inserted at the same time (`--numInsertionWorkers`); `None` keeps one.
    pub insertion_workers: Option<u32>,
    /// Skip the collection's validation rules (`--bypassDocumentValidation`).
    pub bypass_validation: bool,
}

/// Most insert workers the dialog offers; more rarely helps and loads the server.
pub const MAX_INSERTION_WORKERS: u32 = 16;

/// Characters that break mongoimport's `--fields` list with types.
const FORBIDDEN_FIELD_CHARS: [char; 3] = [',', '(', ')'];

impl ImportRequest {
    /// "Import orders.csv into shop.orders".
    pub fn title(&self) -> String {
        let path = self.path.trim();
        let name = Path::new(path)
            .file_name()
            .map_or_else(|| path.into(), |name| name.to_string_lossy());
        format!(
            "Import {name} into {}.{}",
            self.database.trim(),
            self.collection.trim()
        )
    }

    /// The delimiter as one byte; ASCII only.
    pub fn delimiter_byte(&self) -> Result<u8, ToolsError> {
        match self.delimiter.as_bytes() {
            [byte] if !matches!(byte, b'"' | b'\n' | b'\r') => Ok(*byte),
            _ => Err(invalid("Choose one character that separates the values.")),
        }
    }

    /// Indices of the columns RipeMongo passes on, in file order.
    pub fn included_columns(&self) -> Vec<usize> {
        (0..self.columns.len())
            .filter(|&index| self.columns[index].include)
            .collect()
    }

    /// `mongoimport` arguments (without the connection). CSV rows come on standard input.
    pub fn args(&self) -> Result<Vec<String>, ToolsError> {
        let database = self.database.trim();
        let collection = self.collection.trim();
        if database.is_empty() {
            return Err(invalid("Choose the database to import into."));
        }
        if collection.is_empty() {
            return Err(invalid("Enter the collection to import into."));
        }
        check_collection_name(collection)?;
        let path = self.path.trim();
        if path.is_empty() || !Path::new(path).is_absolute() {
            return Err(invalid("Choose the file to import (a full path)."));
        }
        let mut args = vec![
            format!("--db={database}"),
            format!("--collection={collection}"),
        ];
        match self.format {
            ImportFormat::Json => args.push(format!("--file={path}")),
            ImportFormat::JsonArray => {
                args.push(format!("--file={path}"));
                args.push("--jsonArray".into());
            }
            ImportFormat::Csv => {
                self.delimiter_byte()?;
                args.extend(["--type=csv".to_owned(), "--columnsHaveTypes".to_owned()]);
                args.push(format!("--fields={}", self.typed_fields()?.join(",")));
                if self.ignore_blanks {
                    args.push("--ignoreBlanks".into());
                }
                if let Some(grace) = parse_grace(self.parse_errors) {
                    args.push(format!("--parseGrace={grace}"));
                }
            }
        }
        if self.mode != ImportMode::Insert {
            let mode = if self.mode == ImportMode::Upsert {
                "upsert"
            } else {
                "merge"
            };
            args.push(format!("--mode={mode}"));
            let fields: Vec<&str> = self
                .match_fields
                .iter()
                .map(|field| field.trim())
                .filter(|field| !field.is_empty())
                .collect();
            if !fields.is_empty() {
                args.push(format!("--upsertFields={}", fields.join(",")));
            }
        }
        if self.drop {
            args.push("--drop".into());
        }
        if self.stop_on_error {
            args.push("--stopOnError".into());
        }
        if let Some(workers) = self.insertion_workers {
            if !(1..=MAX_INSERTION_WORKERS).contains(&workers) {
                return Err(invalid(&format!(
                    "Use between 1 and {MAX_INSERTION_WORKERS} insert workers."
                )));
            }
            args.push(format!("--numInsertionWorkers={workers}"));
        }
        if self.bypass_validation {
            args.push("--bypassDocumentValidation".into());
        }
        Ok(args)
    }

    /// `name.string(),born.date_ms(yyyy-MM-dd)` entries for the included columns.
    fn typed_fields(&self) -> Result<Vec<String>, ToolsError> {
        let mut fields: Vec<String> = Vec::new();
        let mut names: Vec<&str> = Vec::new();
        for column in self.columns.iter().filter(|column| column.include) {
            let name = column.field.trim();
            if name.is_empty() {
                return Err(invalid("Every imported column needs a field name."));
            }
            if name.starts_with('$') || name.contains(FORBIDDEN_FIELD_CHARS) {
                return Err(invalid(&format!(
                    "“{name}” cannot be a field name here: rename it without a leading $ and \
                     without , ( or )."
                )));
            }
            if names.contains(&name) {
                return Err(invalid(&format!(
                    "Two columns are imported as “{name}”. Rename one of them."
                )));
            }
            names.push(name);
            fields.push(format!(
                "{name}.{}",
                column.kind.spec(column.date_format.trim())?
            ));
        }
        if fields.is_empty() {
            return Err(invalid("Choose at least one column to import."));
        }
        Ok(fields)
    }
}

fn invalid(message: &str) -> ToolsError {
    ToolsError::Invalid(message.to_owned())
}

fn parse_grace(errors: ParseErrors) -> Option<&'static str> {
    match errors {
        ParseErrors::Stop => None,
        ParseErrors::SkipField => Some("skipField"),
        ParseErrors::SkipRow => Some("skipRow"),
        ParseErrors::AutoCast => Some("autoCast"),
    }
}
