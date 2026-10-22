//! A typed JSON document on disk with defaults for missing files and atomic writes.

use std::marker::PhantomData;
use std::path::PathBuf;
use std::sync::Mutex;

use serde::de::DeserializeOwned;
use serde::Serialize;

use super::StorageError;

/// Extension of the temporary file used for atomic writes.
const TEMP_EXTENSION: &str = "json.tmp";

/// Loads and saves a `T` at a fixed path. A missing file yields `T::default()`. Writes are
/// serialized through a mutex and performed atomically (write temp file, then rename), so a
/// crash never leaves a half-written file behind.
#[derive(Debug)]
pub struct JsonFile<T> {
    path: PathBuf,
    write_lock: Mutex<()>,
    _marker: PhantomData<fn() -> T>,
}

impl<T: Serialize + DeserializeOwned + Default> JsonFile<T> {
    /// Creates a handle for the given path. The file does not need to exist yet.
    pub fn new(path: PathBuf) -> Self {
        Self {
            path,
            write_lock: Mutex::new(()),
            _marker: PhantomData,
        }
    }

    /// Reads the document, returning defaults when the file does not exist.
    pub fn load(&self) -> Result<T, StorageError> {
        let raw = match std::fs::read_to_string(&self.path) {
            Ok(raw) => raw,
            Err(error) if error.kind() == std::io::ErrorKind::NotFound => return Ok(T::default()),
            Err(source) => return Err(self.io_error(source)),
        };
        serde_json::from_str(&raw).map_err(|source| StorageError::Parse {
            path: self.path.clone(),
            source,
        })
    }

    /// Persists the document, creating the parent directory when needed.
    pub fn save(&self, value: &T) -> Result<(), StorageError> {
        let json = serde_json::to_string_pretty(value).map_err(StorageError::Serialize)?;
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

    fn io_error(&self, source: std::io::Error) -> StorageError {
        StorageError::Io {
            path: self.path.clone(),
            source,
        }
    }
}

#[cfg(test)]
mod tests {
    use std::path::Path;

    use serde::Deserialize;

    use super::*;

    #[derive(Debug, Default, PartialEq, Serialize, Deserialize)]
    #[serde(default)]
    struct Doc {
        name: String,
        count: u32,
    }

    fn doc_path(dir: &tempfile::TempDir) -> PathBuf {
        dir.path().join("nested").join("doc.json")
    }

    fn file_in(dir: &tempfile::TempDir) -> JsonFile<Doc> {
        JsonFile::new(doc_path(dir))
    }

    fn write_raw(path: &Path, contents: &str) {
        std::fs::create_dir_all(path.parent().unwrap()).unwrap();
        std::fs::write(path, contents).unwrap();
    }

    #[test]
    fn missing_file_yields_defaults() {
        let dir = tempfile::tempdir().unwrap();
        assert_eq!(file_in(&dir).load().unwrap(), Doc::default());
    }

    #[test]
    fn save_then_load_round_trips() {
        let dir = tempfile::tempdir().unwrap();
        let file = file_in(&dir);
        let doc = Doc {
            name: "x".into(),
            count: 3,
        };
        file.save(&doc).unwrap();
        assert_eq!(file.load().unwrap(), doc);
    }

    #[test]
    fn corrupted_file_is_a_parse_error() {
        let dir = tempfile::tempdir().unwrap();
        let file = file_in(&dir);
        write_raw(&doc_path(&dir), "{ not json");
        assert!(matches!(file.load(), Err(StorageError::Parse { .. })));
    }

    #[test]
    fn unknown_and_missing_fields_are_tolerated() {
        let dir = tempfile::tempdir().unwrap();
        let file = file_in(&dir);
        write_raw(&doc_path(&dir), r#"{ "future": true, "count": 2 }"#);
        assert_eq!(file.load().unwrap().count, 2);
    }
}
