//! Shared support for operations against a connected MongoDB deployment: resolving the live
//! client of a connection and turning driver/server errors into actionable messages.

mod errors;

pub use errors::{driver_error, MongoError};

use mongodb::{Client, Database};

use crate::connections::ConnectionManager;

/// The live client of a connected profile, or `NotConnected`.
pub async fn client(
    manager: &ConnectionManager,
    connection_id: &str,
) -> Result<Client, MongoError> {
    Ok(manager.client(connection_id).await?)
}

/// A database handle on a connected profile.
pub async fn database(
    manager: &ConnectionManager,
    connection_id: &str,
    database: &str,
) -> Result<Database, MongoError> {
    require_name(database, "database")?;
    Ok(client(manager, connection_id).await?.database(database))
}

/// Rejects blank names with a user-facing message such as "Enter a collection name.".
pub fn require_name(name: &str, what: &str) -> Result<(), MongoError> {
    if name.trim().is_empty() {
        return Err(MongoError::Invalid(format!("Enter a {what} name.")));
    }
    Ok(())
}
