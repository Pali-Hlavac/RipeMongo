//! Saved dumps, persisted as one JSON file.

use std::path::PathBuf;
use std::sync::Mutex;

use mongodb::bson::DateTime;

use super::{DumpProfileInput, DumpProfilesError, ProfilesFile, StoredDumpProfile};
use crate::storage::JsonFile;

/// Most saved dumps kept.
pub const MAX_PROFILES: usize = 200;
/// Longest name of a saved dump, in characters.
const MAX_NAME_CHARS: usize = 100;

fn now() -> String {
    DateTime::now().try_to_rfc3339_string().unwrap_or_default()
}

/// Saved dumps store; every change is a locked read-modify-write of the file.
#[derive(Debug)]
pub struct DumpProfiles {
    file: JsonFile<ProfilesFile>,
    update_lock: Mutex<()>,
}

impl DumpProfiles {
    pub fn new(path: PathBuf) -> Self {
        Self {
            file: JsonFile::new(path),
            update_lock: Mutex::new(()),
        }
    }

    /// Every saved dump, in the order they were created.
    pub fn list(&self) -> Result<Vec<StoredDumpProfile>, DumpProfilesError> {
        Ok(self.file.load()?.profiles)
    }

    /// One saved dump.
    pub fn get(&self, id: &str) -> Result<StoredDumpProfile, DumpProfilesError> {
        self.list()?
            .into_iter()
            .find(|profile| profile.id == id)
            .ok_or(DumpProfilesError::NotFound)
    }

    /// Creates (`id: None`) or updates a saved dump after checking its settings.
    pub fn save(&self, input: DumpProfileInput) -> Result<StoredDumpProfile, DumpProfilesError> {
        let name = input.name.trim();
        if name.is_empty() {
            return Err(DumpProfilesError::Invalid(
                "Enter a name for the saved dump.".into(),
            ));
        }
        if name.chars().count() > MAX_NAME_CHARS {
            return Err(DumpProfilesError::Invalid(format!(
                "Use a name of at most {MAX_NAME_CHARS} characters."
            )));
        }
        input.request.args()?;
        let name = name.to_owned();
        self.update(|profiles| match input.id {
            Some(id) => {
                let profile = profiles
                    .iter_mut()
                    .find(|profile| profile.id == id)
                    .ok_or(DumpProfilesError::NotFound)?;
                profile.name = name;
                profile.connection_id = input.connection_id;
                profile.request = input.request;
                Ok(profile.clone())
            }
            None if profiles.len() >= MAX_PROFILES => Err(DumpProfilesError::Invalid(format!(
                "You can keep at most {MAX_PROFILES} saved dumps. Delete one first."
            ))),
            None => {
                let profile = StoredDumpProfile {
                    id: uuid::Uuid::new_v4().to_string(),
                    name,
                    connection_id: input.connection_id,
                    request: input.request,
                    created_at: now(),
                    last_run_at: None,
                };
                profiles.push(profile.clone());
                Ok(profile)
            }
        })
    }

    /// Notes that a saved dump was just started.
    pub fn mark_run(&self, id: &str) -> Result<(), DumpProfilesError> {
        self.update(|profiles| {
            if let Some(profile) = profiles.iter_mut().find(|profile| profile.id == id) {
                profile.last_run_at = Some(now());
            }
            Ok(())
        })
    }

    /// Deletes a saved dump; unknown ids are ignored (already gone).
    pub fn delete(&self, id: &str) -> Result<(), DumpProfilesError> {
        self.update(|profiles| {
            profiles.retain(|profile| profile.id != id);
            Ok(())
        })
    }

    /// Removes every saved dump of a connection (after the connection is deleted).
    pub fn forget_connection(&self, connection_id: &str) -> Result<(), DumpProfilesError> {
        self.update(|profiles| {
            profiles.retain(|profile| profile.connection_id != connection_id);
            Ok(())
        })
    }

    /// Locked read-modify-write; the file is only written when something changed.
    fn update<T>(
        &self,
        change: impl FnOnce(&mut Vec<StoredDumpProfile>) -> Result<T, DumpProfilesError>,
    ) -> Result<T, DumpProfilesError> {
        let _guard = self
            .update_lock
            .lock()
            .unwrap_or_else(std::sync::PoisonError::into_inner);
        let mut file = self.file.load()?;
        let before = file.profiles.clone();
        let result = change(&mut file.profiles)?;
        if file.profiles != before {
            self.file.save(&file)?;
        }
        Ok(result)
    }
}
