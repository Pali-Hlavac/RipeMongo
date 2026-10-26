//! Documents: paged `find`, counting, single-document writes (insert, replace, set a
//! field, delete), bulk writes by filter with a preview, and field names from a sample.

mod bulk;
pub mod commands;
mod fields;
mod service;
mod types;
mod writes;

pub use bulk::{
    delete_many, preview_delete_many, preview_update_many, update_many, PREVIEW_SAMPLES,
};
pub use fields::{sample_fields, FieldSample, FIELD_SAMPLE_SIZE};
pub use service::{count_documents, find_documents, MAX_PAGE_SIZE};
pub use types::*;
pub use writes::{
    delete_document, insert_documents, replace_document, set_field, MAX_INSERT_DOCUMENTS,
};
