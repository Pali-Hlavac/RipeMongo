//! In-memory [`SecretStore`] for tests and integration tests. Never used in production.

use std::collections::HashMap;
use std::sync::Mutex;

use super::{SecretStore, SecretsError};

/// Thread-safe map of secrets.
#[derive(Debug, Default)]
pub struct MemorySecretStore {
    secrets: Mutex<HashMap<String, String>>,
}

impl MemorySecretStore {
    fn with_map<T>(&self, action: impl FnOnce(&mut HashMap<String, String>) -> T) -> T {
        // Poisoning only happens if a test panicked mid-operation; the map is still usable.
        let mut map = self
            .secrets
            .lock()
            .unwrap_or_else(std::sync::PoisonError::into_inner);
        action(&mut map)
    }
}

impl SecretStore for MemorySecretStore {
    fn get(&self, key: &str) -> Result<Option<String>, SecretsError> {
        Ok(self.with_map(|map| map.get(key).cloned()))
    }

    fn set(&self, key: &str, value: &str) -> Result<(), SecretsError> {
        self.with_map(|map| map.insert(key.to_owned(), value.to_owned()));
        Ok(())
    }

    fn delete(&self, key: &str) -> Result<(), SecretsError> {
        self.with_map(|map| map.remove(key));
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn set_get_delete() {
        let store = MemorySecretStore::default();
        assert_eq!(store.get("k").unwrap(), None);
        store.set("k", "v").unwrap();
        assert_eq!(store.get("k").unwrap().as_deref(), Some("v"));
        store.delete("k").unwrap();
        store.delete("k").unwrap();
        assert_eq!(store.get("k").unwrap(), None);
    }
}
