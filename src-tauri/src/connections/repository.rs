//! Persistence of saved connection profiles in `connections.json`.

use std::path::PathBuf;
use std::sync::Mutex;

use serde::{Deserialize, Serialize};

use super::{ConnectionError, ConnectionProfile};
use crate::storage::JsonFile;

/// Current schema version of `connections.json`.
const DOCUMENT_VERSION: u32 = 1;

#[derive(Debug, Serialize, Deserialize)]
struct ConnectionsDocument {
    version: u32,
    connections: Vec<ConnectionProfile>,
}

impl Default for ConnectionsDocument {
    fn default() -> Self {
        Self {
            version: DOCUMENT_VERSION,
            connections: Vec::new(),
        }
    }
}

/// CRUD over saved profiles. Read-modify-write cycles are serialized by a mutex.
#[derive(Debug)]
pub struct ConnectionRepository {
    file: JsonFile<ConnectionsDocument>,
    update_lock: Mutex<()>,
}

impl ConnectionRepository {
    pub fn new(path: PathBuf) -> Self {
        Self {
            file: JsonFile::new(path),
            update_lock: Mutex::new(()),
        }
    }

    /// All saved profiles in insertion order.
    pub fn list(&self) -> Result<Vec<ConnectionProfile>, ConnectionError> {
        Ok(self.file.load()?.connections)
    }

    /// One profile by id.
    pub fn get(&self, id: &str) -> Result<ConnectionProfile, ConnectionError> {
        self.list()?
            .into_iter()
            .find(|profile| profile.id == id)
            .ok_or_else(|| ConnectionError::NotFound(id.to_owned()))
    }

    /// Inserts a new profile (assigning an id when empty) or replaces an existing one.
    pub fn upsert(
        &self,
        mut profile: ConnectionProfile,
    ) -> Result<ConnectionProfile, ConnectionError> {
        if profile.id.is_empty() {
            profile.id = uuid::Uuid::new_v4().to_string();
        }
        self.modify(|doc| {
            match doc.connections.iter_mut().find(|p| p.id == profile.id) {
                Some(existing) => *existing = profile.clone(),
                None => doc.connections.push(profile.clone()),
            }
            Ok(())
        })?;
        Ok(profile)
    }

    /// Removes a profile; fails with `NotFound` if it does not exist.
    pub fn delete(&self, id: &str) -> Result<(), ConnectionError> {
        self.modify(|doc| {
            let before = doc.connections.len();
            doc.connections.retain(|profile| profile.id != id);
            if doc.connections.len() == before {
                return Err(ConnectionError::NotFound(id.to_owned()));
            }
            Ok(())
        })
    }

    fn modify(
        &self,
        change: impl FnOnce(&mut ConnectionsDocument) -> Result<(), ConnectionError>,
    ) -> Result<(), ConnectionError> {
        // Poisoning only means a previous writer panicked; the file is still consistent.
        let _guard = self
            .update_lock
            .lock()
            .unwrap_or_else(std::sync::PoisonError::into_inner);
        let mut doc = self.file.load()?;
        change(&mut doc)?;
        doc.version = DOCUMENT_VERSION;
        Ok(self.file.save(&doc)?)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::connections::ConnectionConfig;

    fn profile(name: &str) -> ConnectionProfile {
        ConnectionProfile {
            id: String::new(),
            name: name.into(),
            folder: None,
            favorite: false,
            color: None,
            config: ConnectionConfig::default(),
        }
    }

    fn repository(dir: &tempfile::TempDir) -> ConnectionRepository {
        ConnectionRepository::new(dir.path().join("connections.json"))
    }

    #[test]
    fn upsert_assigns_ids_and_replaces_in_place() {
        let dir = tempfile::tempdir().unwrap();
        let repo = repository(&dir);
        let first = repo.upsert(profile("a")).unwrap();
        let second = repo.upsert(profile("b")).unwrap();
        assert_ne!(first.id, second.id);

        let renamed = ConnectionProfile {
            name: "a2".into(),
            ..first.clone()
        };
        repo.upsert(renamed).unwrap();
        let names: Vec<_> = repo.list().unwrap().into_iter().map(|p| p.name).collect();
        assert_eq!(names, ["a2", "b"]);
        assert_eq!(repo.get(&first.id).unwrap().name, "a2");
    }

    #[test]
    fn delete_removes_and_reports_missing() {
        let dir = tempfile::tempdir().unwrap();
        let repo = repository(&dir);
        let saved = repo.upsert(profile("a")).unwrap();
        repo.delete(&saved.id).unwrap();
        assert!(repo.list().unwrap().is_empty());
        assert!(matches!(
            repo.delete(&saved.id),
            Err(ConnectionError::NotFound(_))
        ));
        assert!(matches!(
            repo.get(&saved.id),
            Err(ConnectionError::NotFound(_))
        ));
    }
}
