//! Database operations on a driver client, independent of Tauri.

use mongodb::Client;
use serde::Serialize;
use specta::Type;

use crate::mongo::{require_name, MongoError};

/// A database as shown in the sidebar.
#[derive(Debug, Clone, PartialEq, Serialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct DatabaseInfo {
    pub name: String,
    /// Size on disk in bytes (as a float: JS numbers cannot hold every u64).
    pub size_on_disk: f64,
    pub empty: bool,
}

/// Lists databases the user may see, sorted by name. `authorizedDatabases` lets users
/// without the `listDatabases` privilege still see the databases they can access.
pub async fn list_databases(client: &Client) -> Result<Vec<DatabaseInfo>, MongoError> {
    let mut databases: Vec<DatabaseInfo> = client
        .list_databases()
        .authorized_databases(true)
        .await?
        .into_iter()
        .map(|spec| DatabaseInfo {
            name: spec.name,
            // Precision loss only above 2^53 bytes (8 PiB), far beyond any real database.
            #[allow(clippy::cast_precision_loss)]
            size_on_disk: spec.size_on_disk as f64,
            empty: spec.empty,
        })
        .collect();
    databases.sort_by(|a, b| a.name.cmp(&b.name));
    Ok(databases)
}

/// MongoDB creates databases lazily, so a new database needs its first collection.
pub async fn create_database(
    client: &Client,
    database: &str,
    first_collection: &str,
) -> Result<(), MongoError> {
    require_name(database, "database")?;
    require_name(first_collection, "first collection")?;
    client
        .database(database)
        .create_collection(first_collection)
        .await?;
    Ok(())
}

/// Drops a database and everything in it.
pub async fn drop_database(client: &Client, database: &str) -> Result<(), MongoError> {
    require_name(database, "database")?;
    client.database(database).drop().await?;
    Ok(())
}
