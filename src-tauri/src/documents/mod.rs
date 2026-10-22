//! Reading documents: paged `find` and counting. Writes arrive with the CRUD slice.

pub mod commands;
mod service;
mod types;

pub use service::{count_documents, find_documents, MAX_PAGE_SIZE};
pub use types::*;
