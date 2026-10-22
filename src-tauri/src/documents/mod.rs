//! Documents: paged `find`, counting, and single-document writes (insert, replace, set a
//! field, delete).

pub mod commands;
mod service;
mod types;
mod writes;

pub use service::{count_documents, find_documents, MAX_PAGE_SIZE};
pub use types::*;
pub use writes::{
    delete_document, insert_documents, replace_document, set_field, MAX_INSERT_DOCUMENTS,
};
