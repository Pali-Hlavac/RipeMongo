//! Per-connection secrets: their keychain keys, and how the UI updates them without the
//! backend ever sending stored values back to the webview.

use serde::{Deserialize, Serialize};
use specta::Type;

use crate::secrets::{SecretStore, SecretsError};

/// Secrets a connection may need. Only lives in memory while connecting or editing.
#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct ConnectionSecrets {
    pub password: Option<String>,
    pub aws_session_token: Option<String>,
    pub tls_key_password: Option<String>,
    pub ssh_password: Option<String>,
    pub ssh_key_passphrase: Option<String>,
}

/// What to do with one stored secret when saving a connection.
#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize, Deserialize, Type)]
#[serde(tag = "action", content = "value", rename_all = "camelCase")]
pub enum SecretUpdate {
    /// Leave the stored value untouched.
    #[default]
    Keep,
    /// Store a new value.
    Set(String),
    /// Remove the stored value.
    Clear,
}

/// Updates for every secret of a connection.
#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct SecretUpdates {
    pub password: SecretUpdate,
    pub aws_session_token: SecretUpdate,
    pub tls_key_password: SecretUpdate,
    pub ssh_password: SecretUpdate,
    pub ssh_key_passphrase: SecretUpdate,
}

/// Which secrets are stored for a connection; lets the UI show "saved" placeholders.
#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct StoredSecrets {
    pub password: bool,
    pub aws_session_token: bool,
    pub tls_key_password: bool,
    pub ssh_password: bool,
    pub ssh_key_passphrase: bool,
}

const KINDS: [&str; 5] = [
    "password",
    "aws-session-token",
    "tls-key-password",
    "ssh-password",
    "ssh-key-passphrase",
];

fn key(connection_id: &str, kind: &str) -> String {
    format!("connection/{connection_id}/{kind}")
}

impl ConnectionSecrets {
    fn fields_mut(&mut self) -> [&mut Option<String>; 5] {
        [
            &mut self.password,
            &mut self.aws_session_token,
            &mut self.tls_key_password,
            &mut self.ssh_password,
            &mut self.ssh_key_passphrase,
        ]
    }

    fn fields(&self) -> [&Option<String>; 5] {
        [
            &self.password,
            &self.aws_session_token,
            &self.tls_key_password,
            &self.ssh_password,
            &self.ssh_key_passphrase,
        ]
    }

    /// Loads all stored secrets of a connection.
    pub fn load(store: &dyn SecretStore, connection_id: &str) -> Result<Self, SecretsError> {
        let mut secrets = Self::default();
        for (field, kind) in secrets.fields_mut().into_iter().zip(KINDS) {
            *field = store.get(&key(connection_id, kind))?;
        }
        Ok(secrets)
    }

    /// Stores every present secret (used by import and duplicate).
    pub fn save(&self, store: &dyn SecretStore, connection_id: &str) -> Result<(), SecretsError> {
        for (field, kind) in self.fields().into_iter().zip(KINDS) {
            if let Some(value) = field {
                store.set(&key(connection_id, kind), value)?;
            }
        }
        Ok(())
    }

    /// Applies `updates` on top of these (stored) secrets, in memory only.
    #[must_use]
    pub fn with_updates(mut self, updates: &SecretUpdates) -> Self {
        for (field, update) in self.fields_mut().into_iter().zip(updates.as_array()) {
            match update {
                SecretUpdate::Keep => {}
                SecretUpdate::Set(value) => *field = Some(value.clone()),
                SecretUpdate::Clear => *field = None,
            }
        }
        self
    }

    /// Which secrets are present.
    pub fn presence(&self) -> StoredSecrets {
        let [password, aws_session_token, tls_key_password, ssh_password, ssh_key_passphrase] =
            self.fields().map(Option::is_some);
        StoredSecrets {
            password,
            aws_session_token,
            tls_key_password,
            ssh_password,
            ssh_key_passphrase,
        }
    }
}

impl SecretUpdates {
    fn as_array(&self) -> [&SecretUpdate; 5] {
        [
            &self.password,
            &self.aws_session_token,
            &self.tls_key_password,
            &self.ssh_password,
            &self.ssh_key_passphrase,
        ]
    }

    /// Persists the updates for a connection (`Keep` entries are not touched).
    pub fn apply(&self, store: &dyn SecretStore, connection_id: &str) -> Result<(), SecretsError> {
        for (update, kind) in self.as_array().into_iter().zip(KINDS) {
            match update {
                SecretUpdate::Keep => {}
                SecretUpdate::Set(value) => store.set(&key(connection_id, kind), value)?,
                SecretUpdate::Clear => store.delete(&key(connection_id, kind))?,
            }
        }
        Ok(())
    }
}

/// Removes every secret of a connection (on delete).
pub fn delete_all(store: &dyn SecretStore, connection_id: &str) -> Result<(), SecretsError> {
    KINDS
        .iter()
        .try_for_each(|kind| store.delete(&key(connection_id, kind)))
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::secrets::MemorySecretStore;

    #[test]
    fn apply_load_and_delete() {
        let store = MemorySecretStore::default();
        let updates = SecretUpdates {
            password: SecretUpdate::Set("pw".into()),
            ssh_password: SecretUpdate::Set("ssh".into()),
            ..SecretUpdates::default()
        };
        updates.apply(&store, "c1").unwrap();
        let loaded = ConnectionSecrets::load(&store, "c1").unwrap();
        assert_eq!(loaded.password.as_deref(), Some("pw"));
        assert!(loaded.presence().ssh_password);
        assert!(!loaded.presence().tls_key_password);

        let clear = SecretUpdates {
            password: SecretUpdate::Clear,
            ..SecretUpdates::default()
        };
        clear.apply(&store, "c1").unwrap();
        let after = ConnectionSecrets::load(&store, "c1").unwrap();
        assert_eq!(after.password, None);
        assert_eq!(after.ssh_password.as_deref(), Some("ssh"));

        delete_all(&store, "c1").unwrap();
        assert_eq!(
            ConnectionSecrets::load(&store, "c1").unwrap(),
            ConnectionSecrets::default()
        );
    }

    #[test]
    fn with_updates_overlays_in_memory() {
        let stored = ConnectionSecrets {
            password: Some("old".into()),
            ssh_password: Some("keep".into()),
            ..ConnectionSecrets::default()
        };
        let updates = SecretUpdates {
            password: SecretUpdate::Set("new".into()),
            ssh_password: SecretUpdate::Clear,
            ..SecretUpdates::default()
        };
        let merged = stored.with_updates(&updates);
        assert_eq!(merged.password.as_deref(), Some("new"));
        assert_eq!(merged.ssh_password, None);
    }
}
