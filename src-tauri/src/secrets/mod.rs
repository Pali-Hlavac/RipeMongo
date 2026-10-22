//! Secret storage. Production code uses the OS keychain; tests use an in-memory store.
//!
//! Secrets (passwords, passphrases, tokens) never touch config files or logs.

mod error;
mod keyring_store;
mod memory_store;

use std::sync::Arc;

pub use error::SecretsError;
pub use keyring_store::KeyringSecretStore;
pub use memory_store::MemorySecretStore;

/// Keychain service name under which every RipeMongo secret is stored.
pub const KEYCHAIN_SERVICE: &str = "com.ripemongo.app";

/// Minimal key/value interface over a secret store.
pub trait SecretStore: Send + Sync {
    /// Returns the secret, or `None` if nothing is stored under `key`.
    fn get(&self, key: &str) -> Result<Option<String>, SecretsError>;
    /// Stores or replaces the secret under `key`.
    fn set(&self, key: &str, value: &str) -> Result<(), SecretsError>;
    /// Removes the secret; deleting a missing key is not an error.
    fn delete(&self, key: &str) -> Result<(), SecretsError>;
}

/// Managed-state handle to the active secret store.
pub type SharedSecretStore = Arc<dyn SecretStore>;
