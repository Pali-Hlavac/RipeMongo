//! [`SecretStore`] backed by the OS keychain via the `keyring` crate
//! (Windows Credential Manager, macOS Keychain, Linux Secret Service).

use super::{SecretStore, SecretsError};

/// OS keychain store; every entry lives under one service name.
#[derive(Debug, Clone)]
pub struct KeyringSecretStore {
    service: String,
}

impl KeyringSecretStore {
    pub fn new(service: impl Into<String>) -> Self {
        Self {
            service: service.into(),
        }
    }

    fn entry(&self, key: &str) -> Result<keyring::Entry, SecretsError> {
        Ok(keyring::Entry::new(&self.service, key)?)
    }
}

impl SecretStore for KeyringSecretStore {
    fn get(&self, key: &str) -> Result<Option<String>, SecretsError> {
        match self.entry(key)?.get_password() {
            Ok(secret) => Ok(Some(secret)),
            Err(keyring::Error::NoEntry) => Ok(None),
            Err(error) => Err(error.into()),
        }
    }

    fn set(&self, key: &str, value: &str) -> Result<(), SecretsError> {
        Ok(self.entry(key)?.set_password(value)?)
    }

    fn delete(&self, key: &str) -> Result<(), SecretsError> {
        match self.entry(key)?.delete_credential() {
            Ok(()) | Err(keyring::Error::NoEntry) => Ok(()),
            Err(error) => Err(error.into()),
        }
    }
}
