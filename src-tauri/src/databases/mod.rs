//! Databases of a connected deployment: list, create (with a first collection), drop.

pub mod commands;
mod service;

pub use service::{create_database, drop_database, list_databases, DatabaseInfo};
