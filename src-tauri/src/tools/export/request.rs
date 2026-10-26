//! What to export and how: the request from the export dialog and its `mongoexport`
//! arguments.

use std::path::Path;

use mongodb::bson::{Bson, Document};
use serde::{Deserialize, Serialize};
use specta::Type;

use crate::ejson;
use crate::tools::ToolsError;

/// File format of an export.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Type)]
#[serde(rename_all = "lowercase")]
pub enum ExportFormat {
    /// Extended JSON, one document per line or a JSON array.
    Json,
    /// Comma-separated values with the chosen fields as columns.
    Csv,
}

/// An export of one collection (or view) to a file. Options of the other format are ignored.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct ExportRequest {
    pub database: String,
    pub collection: String,
    /// Absolute path of the file to write.
    pub path: String,
    pub format: ExportFormat,
    /// Fields to export (`--fields`); empty exports whole documents (JSON only).
    pub fields: Vec<String>,
    /// JSON: one array instead of one document per line (`--jsonArray`).
    pub json_array: bool,
    /// JSON: indented (`--pretty`).
    pub pretty: bool,
    /// JSON: canonical Extended JSON that keeps every type (`--jsonFormat=canonical`).
    pub canonical: bool,
    /// CSV: field names as the first line (otherwise `--noHeaderLine`).
    pub header: bool,
    /// Filter in the documents filter syntax; blank exports every document.
    pub query: Option<String>,
    /// Sort in the documents sort syntax.
    pub sort: Option<String>,
    pub skip: Option<u32>,
    /// Most documents to export; `None` or 0 exports all.
    pub limit: Option<u32>,
}

impl ExportRequest {
    /// "Export shop.orders".
    pub fn title(&self) -> String {
        format!("Export {}.{}", self.database.trim(), self.collection.trim())
    }

    /// Fields to export, trimmed, blanks dropped.
    fn chosen_fields(&self) -> impl Iterator<Item = &str> {
        self.fields
            .iter()
            .map(|field| field.trim())
            .filter(|field| !field.is_empty())
    }

    /// `mongoexport` arguments (without the connection).
    pub fn args(&self) -> Result<Vec<String>, ToolsError> {
        let database = self.database.trim();
        let collection = self.collection.trim();
        if database.is_empty() || collection.is_empty() {
            return Err(invalid("Choose the collection to export."));
        }
        let path = self.path.trim();
        if path.is_empty() || !Path::new(path).is_absolute() {
            return Err(invalid("Choose where to save the export (a full path)."));
        }
        let fields: Vec<&str> = self.chosen_fields().collect();
        if self.format == ExportFormat::Csv && fields.is_empty() {
            return Err(invalid("Choose the fields that become the CSV columns."));
        }
        if let Some(field) = fields.iter().find(|field| field.contains(',')) {
            return Err(invalid(&format!(
                "The field “{field}” cannot be exported by name because it contains a comma."
            )));
        }
        let query = parse_part(self.query.as_deref(), "query filter")?;
        let sort = parse_part(self.sort.as_deref(), "sort")?;

        let mut args = vec![
            format!("--db={database}"),
            format!("--collection={collection}"),
            format!("--out={path}"),
        ];
        match self.format {
            ExportFormat::Json => {
                if self.json_array {
                    args.push("--jsonArray".into());
                }
                if self.pretty {
                    args.push("--pretty".into());
                }
                if self.canonical {
                    args.push("--jsonFormat=canonical".into());
                }
            }
            ExportFormat::Csv => {
                args.push("--type=csv".into());
                if !self.header {
                    args.push("--noHeaderLine".into());
                }
            }
        }
        if !fields.is_empty() {
            args.push(format!("--fields={}", fields.join(",")));
        }
        if let Some(query) = query {
            args.push(format!("--query={}", ejson::to_canonical_json(query)));
        }
        if let Some(sort) = sort {
            // `--sort` reads plain JSON numbers; canonical `{"$numberInt": "-1"}` is refused.
            let relaxed = Bson::Document(sort).into_relaxed_extjson();
            args.push(format!("--sort={relaxed}"));
        }
        if let Some(skip) = self.skip.filter(|skip| *skip > 0) {
            args.push(format!("--skip={skip}"));
        }
        if let Some(limit) = self.limit.filter(|limit| *limit > 0) {
            args.push(format!("--limit={limit}"));
        }
        Ok(args)
    }
}

fn invalid(message: &str) -> ToolsError {
    ToolsError::Invalid(message.to_owned())
}

/// A filter or sort in the documents syntax; `None` when blank or `{}`.
fn parse_part(text: Option<&str>, name: &str) -> Result<Option<Document>, ToolsError> {
    let Some(text) = text.map(str::trim).filter(|text| !text.is_empty()) else {
        return Ok(None);
    };
    let document = ejson::parse_document(text)
        .map_err(|error| invalid(&format!("The {name} is not valid: {error}")))?;
    Ok((!document.is_empty()).then_some(document))
}
