//! Recent and favorite queries per collection, persisted as one JSON file.

use std::path::PathBuf;
use std::sync::Mutex;

use mongodb::bson::DateTime;

use super::{CollectionQueries, HistoryFile, QueryHistoryError, QueryParts, SavedQuery};
use crate::storage::JsonFile;

/// Recent runs kept per collection.
pub const MAX_RECENT: usize = 30;
/// Favorites kept per collection.
pub const MAX_FAVORITES: usize = 100;

/// Identifies one collection of one saved connection.
#[derive(Debug, Clone, Copy)]
pub struct Namespace<'a> {
    pub connection_id: &'a str,
    pub database: &'a str,
    pub collection: &'a str,
}

impl Namespace<'_> {
    fn key(&self) -> String {
        format!(
            "{}/{}.{}",
            self.connection_id, self.database, self.collection
        )
    }
}

fn now() -> String {
    DateTime::now().try_to_rfc3339_string().unwrap_or_default()
}

/// Query history store; every change is a locked read-modify-write of the file.
#[derive(Debug)]
pub struct QueryHistory {
    file: JsonFile<HistoryFile>,
    update_lock: Mutex<()>,
}

impl QueryHistory {
    pub fn new(path: PathBuf) -> Self {
        Self {
            file: JsonFile::new(path),
            update_lock: Mutex::new(()),
        }
    }

    /// Recent and favorite queries of a collection (empty if none yet).
    pub fn list(&self, namespace: Namespace<'_>) -> Result<CollectionQueries, QueryHistoryError> {
        Ok(self
            .file
            .load()?
            .collections
            .remove(&namespace.key())
            .unwrap_or_default())
    }

    /// Remembers a successful run: moves an identical query to the front instead of
    /// duplicating it. Blank queries are not recorded.
    pub fn record(
        &self,
        namespace: Namespace<'_>,
        query: QueryParts,
    ) -> Result<CollectionQueries, QueryHistoryError> {
        if query.is_blank() {
            return self.list(namespace);
        }
        self.update(namespace, |queries| {
            queries.recent.retain(|saved| !saved.query.same_as(&query));
            queries.recent.insert(
                0,
                SavedQuery {
                    id: uuid::Uuid::new_v4().to_string(),
                    name: None,
                    query,
                    saved_at: now(),
                },
            );
            queries.recent.truncate(MAX_RECENT);
            Ok(())
        })
    }

    /// Saves a named favorite; an existing favorite with the same name is replaced.
    pub fn save_favorite(
        &self,
        namespace: Namespace<'_>,
        name: &str,
        query: QueryParts,
    ) -> Result<CollectionQueries, QueryHistoryError> {
        let name = name.trim();
        if name.is_empty() {
            return Err(QueryHistoryError::Invalid(
                "Enter a name for the favorite.".into(),
            ));
        }
        if query.is_blank() {
            return Err(QueryHistoryError::Invalid(
                "Type a query before saving it as a favorite.".into(),
            ));
        }
        self.update(namespace, |queries| {
            let favorite = SavedQuery {
                id: uuid::Uuid::new_v4().to_string(),
                name: Some(name.to_owned()),
                query,
                saved_at: now(),
            };
            let existing = queries
                .favorites
                .iter()
                .position(|saved| saved.name.as_deref() == Some(name));
            match existing {
                Some(index) => queries.favorites[index] = favorite,
                None if queries.favorites.len() >= MAX_FAVORITES => {
                    return Err(QueryHistoryError::Invalid(format!(
                        "A collection can have at most {MAX_FAVORITES} favorites. Delete one first."
                    )));
                }
                None => queries.favorites.push(favorite),
            }
            Ok(())
        })
    }

    /// Deletes a favorite; unknown ids are ignored (already gone).
    pub fn delete_favorite(
        &self,
        namespace: Namespace<'_>,
        id: &str,
    ) -> Result<CollectionQueries, QueryHistoryError> {
        self.update(namespace, |queries| {
            queries.favorites.retain(|saved| saved.id != id);
            Ok(())
        })
    }

    /// Removes every saved query of a connection (after the connection is deleted).
    pub fn forget_connection(&self, connection_id: &str) -> Result<(), QueryHistoryError> {
        let _guard = self
            .update_lock
            .lock()
            .unwrap_or_else(std::sync::PoisonError::into_inner);
        let mut file = self.file.load()?;
        let prefix = format!("{connection_id}/");
        let before = file.collections.len();
        file.collections.retain(|key, _| !key.starts_with(&prefix));
        if file.collections.len() != before {
            self.file.save(&file)?;
        }
        Ok(())
    }

    fn update(
        &self,
        namespace: Namespace<'_>,
        change: impl FnOnce(&mut CollectionQueries) -> Result<(), QueryHistoryError>,
    ) -> Result<CollectionQueries, QueryHistoryError> {
        let _guard = self
            .update_lock
            .lock()
            .unwrap_or_else(std::sync::PoisonError::into_inner);
        let mut file = self.file.load()?;
        let queries = file.collections.entry(namespace.key()).or_default();
        change(queries)?;
        let result = queries.clone();
        self.file.save(&file)?;
        Ok(result)
    }
}
