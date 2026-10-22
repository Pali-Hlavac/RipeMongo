//! File-backed settings store. Independent of Tauri so it can be tested with a temp dir.

use std::path::PathBuf;
use std::sync::Mutex;

use super::{Settings, SettingsError};

/// Extension of the temporary file used for atomic writes.
const TEMP_EXTENSION: &str = "json.tmp";

/// Loads and saves [`Settings`] at a fixed path. Writes are serialized through a mutex
/// and performed atomically (write temp file, then rename) so a crash never leaves a
/// half-written file behind.
#[derive(Debug)]
pub struct SettingsStore {
    path: PathBuf,
    write_lock: Mutex<()>,
}

impl SettingsStore {
    /// Creates a store for the given file path. The file does not need to exist yet.
    pub fn new(path: PathBuf) -> Self {
        Self {
            path,
            write_lock: Mutex::new(()),
        }
    }

    /// Reads settings from disk, returning defaults when the file does not exist.
    pub fn load(&self) -> Result<Settings, SettingsError> {
        let raw = match std::fs::read_to_string(&self.path) {
            Ok(raw) => raw,
            Err(error) if error.kind() == std::io::ErrorKind::NotFound => {
                return Ok(Settings::default())
            }
            Err(source) => return Err(self.io_error(source)),
        };
        serde_json::from_str(&raw).map_err(|source| SettingsError::Parse {
            path: self.path.clone(),
            source,
        })
    }

    /// Persists settings, creating the parent directory when needed.
    pub fn save(&self, settings: &Settings) -> Result<(), SettingsError> {
        let json = serde_json::to_string_pretty(settings).map_err(SettingsError::Serialize)?;
        // A poisoned lock only means another writer panicked; the file itself is still
        // consistent thanks to the atomic rename, so it is safe to continue.
        let _guard = self
            .write_lock
            .lock()
            .unwrap_or_else(std::sync::PoisonError::into_inner);
        if let Some(parent) = self.path.parent() {
            std::fs::create_dir_all(parent).map_err(|source| self.io_error(source))?;
        }
        let temp_path = self.path.with_extension(TEMP_EXTENSION);
        std::fs::write(&temp_path, json).map_err(|source| self.io_error(source))?;
        std::fs::rename(&temp_path, &self.path).map_err(|source| self.io_error(source))
    }

    fn io_error(&self, source: std::io::Error) -> SettingsError {
        SettingsError::Io {
            path: self.path.clone(),
            source,
        }
    }
}

#[cfg(test)]
mod tests {
    use std::path::Path;

    use super::*;
    use crate::settings::types::ThemePreference;

    fn settings_path(dir: &tempfile::TempDir) -> PathBuf {
        dir.path().join("nested").join("settings.json")
    }

    fn write_raw(path: &Path, contents: &str) {
        std::fs::create_dir_all(path.parent().unwrap()).unwrap();
        std::fs::write(path, contents).unwrap();
    }

    #[test]
    fn missing_file_yields_defaults() {
        let dir = tempfile::tempdir().unwrap();
        let store = SettingsStore::new(settings_path(&dir));
        assert_eq!(store.load().unwrap(), Settings::default());
    }

    #[test]
    fn save_then_load_round_trips() {
        let dir = tempfile::tempdir().unwrap();
        let store = SettingsStore::new(settings_path(&dir));
        let settings = Settings {
            theme: ThemePreference::Dark,
        };
        store.save(&settings).unwrap();
        assert_eq!(store.load().unwrap(), settings);
    }

    #[test]
    fn corrupted_file_is_a_parse_error() {
        let dir = tempfile::tempdir().unwrap();
        let path = settings_path(&dir);
        write_raw(&path, "{ not json");
        let result = SettingsStore::new(path).load();
        assert!(matches!(result, Err(SettingsError::Parse { .. })));
    }

    #[test]
    fn unknown_and_missing_fields_are_tolerated() {
        let dir = tempfile::tempdir().unwrap();
        let path = settings_path(&dir);
        write_raw(&path, r#"{ "futureOption": true }"#);
        assert_eq!(
            SettingsStore::new(path).load().unwrap(),
            Settings::default()
        );
    }
}
