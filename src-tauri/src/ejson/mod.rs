//! Extended JSON in and out (ADR 0012).
//!
//! Input: users type JSON, Extended JSON or mongosh-style syntax (`{_id: ObjectId("…")}`).
//! [`shell`] converts that into Extended JSON, which `bson` turns into typed BSON.
//! Output: documents leave the backend as canonical Extended JSON strings, which keep every
//! BSON type (Int32 vs Int64 vs Double, Decimal128, Binary subtypes, …) lossless.

mod dates;
mod error;
mod shell;
#[cfg(test)]
mod tests;

use mongodb::bson::{Bson, Document};

pub use error::EjsonError;

/// Parses a single value written in JSON, Extended JSON or shell syntax.
pub fn parse_value(text: &str) -> Result<Bson, EjsonError> {
    let json = shell::parse(text)?;
    Bson::try_from(json).map_err(|error| EjsonError::Invalid(error.to_string()))
}

/// Parses a document. Blank input is an empty document (`{}`), which is what an empty
/// filter or projection field means.
pub fn parse_document(text: &str) -> Result<Document, EjsonError> {
    if text.trim().is_empty() {
        return Ok(Document::new());
    }
    match parse_value(text)? {
        Bson::Document(document) => Ok(document),
        other => Err(EjsonError::Expected {
            expected: "a document like { field: value }",
            found: type_name(&other),
        }),
    }
}

/// Parses one document or an array of documents (used for inserts and pipelines).
pub fn parse_documents(text: &str) -> Result<Vec<Document>, EjsonError> {
    match parse_value(text)? {
        Bson::Document(document) => Ok(vec![document]),
        Bson::Array(items) => items
            .into_iter()
            .map(|item| match item {
                Bson::Document(document) => Ok(document),
                other => Err(EjsonError::Expected {
                    expected: "only documents inside the array",
                    found: type_name(&other),
                }),
            })
            .collect(),
        other => Err(EjsonError::Expected {
            expected: "a document or an array of documents",
            found: type_name(&other),
        }),
    }
}

/// Serializes a document as canonical Extended JSON (lossless, type-preserving).
pub fn to_canonical_json(document: Document) -> String {
    Bson::Document(document)
        .into_canonical_extjson()
        .to_string()
}

fn type_name(value: &Bson) -> &'static str {
    match value {
        Bson::Array(_) => "an array",
        Bson::String(_) => "a string",
        Bson::Boolean(_) => "a boolean",
        Bson::Null => "null",
        Bson::Int32(_) | Bson::Int64(_) | Bson::Double(_) | Bson::Decimal128(_) => "a number",
        _ => "a scalar value",
    }
}
