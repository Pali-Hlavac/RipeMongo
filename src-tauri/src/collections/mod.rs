//! Collections and views of a database: list, stats, create (standard, capped,
//! time-series, view), rename, drop.

pub mod commands;
mod options;
mod service;
mod types;

pub use service::{
    collection_stats, create_collection, create_view, drop_collection, list_collections,
    rename_collection,
};
pub use types::*;
