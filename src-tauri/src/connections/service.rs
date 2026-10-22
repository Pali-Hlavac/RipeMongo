//! Connection use cases, independent of Tauri: saving profiles with their secrets,
//! testing settings, and opening/closing live connections.

use std::path::{Path, PathBuf};

use super::client::open_client;
use super::registry::{ActiveConnection, ConnectionRegistry};
use super::repository::ConnectionRepository;
use super::{
    delete_secrets, fetch_server_info, validate_config, validate_profile, ActiveConnectionInfo,
    ConnectionConfig, ConnectionError, ConnectionProfile, ConnectionSecrets, SecretUpdates,
    ServerInfo, StoredSecrets,
};
use crate::secrets::{SecretsError, SharedSecretStore};

/// File name of saved profiles inside the app-config directory.
const CONNECTIONS_FILE_NAME: &str = "connections.json";
/// File name of RipeMongo's own SSH known_hosts.
const KNOWN_HOSTS_FILE_NAME: &str = "known_hosts";
/// Suffix appended to the name of a duplicated connection.
const COPY_SUFFIX: &str = " (copy)";

type Result<T> = std::result::Result<T, ConnectionError>;

/// Entry point for every connection operation.
pub struct ConnectionManager {
    repository: ConnectionRepository,
    secrets: SharedSecretStore,
    registry: ConnectionRegistry,
    known_hosts: PathBuf,
}

impl ConnectionManager {
    /// Stores profiles and known_hosts under `config_dir`, secrets in `secrets`.
    pub fn new(config_dir: &Path, secrets: SharedSecretStore) -> Self {
        Self {
            repository: ConnectionRepository::new(config_dir.join(CONNECTIONS_FILE_NAME)),
            secrets,
            registry: ConnectionRegistry::default(),
            known_hosts: config_dir.join(KNOWN_HOSTS_FILE_NAME),
        }
    }

    pub fn list(&self) -> Result<Vec<ConnectionProfile>> {
        self.repository.list()
    }

    /// Validates and saves a profile, then applies the secret updates.
    pub fn save(
        &self,
        profile: ConnectionProfile,
        updates: &SecretUpdates,
    ) -> Result<ConnectionProfile> {
        validate_profile(&profile).map_err(ConnectionError::Invalid)?;
        let saved = self.repository.upsert(profile)?;
        updates.apply(self.secrets.as_ref(), &saved.id)?;
        Ok(saved)
    }

    /// Disconnects (if connected) and deletes a profile and its secrets.
    pub async fn delete(&self, id: &str) -> Result<()> {
        self.registry.remove(id).await;
        self.repository.delete(id)?;
        delete_secrets(self.secrets.as_ref(), id)?;
        Ok(())
    }

    /// Copies a profile, including its secrets, under a new id.
    pub fn duplicate(&self, id: &str) -> Result<ConnectionProfile> {
        let original = self.repository.get(id)?;
        let secrets = ConnectionSecrets::load(self.secrets.as_ref(), id)?;
        let copy = ConnectionProfile {
            id: String::new(),
            name: format!("{}{COPY_SUFFIX}", original.name),
            ..original
        };
        let saved = self.repository.upsert(copy)?;
        secrets.save(self.secrets.as_ref(), &saved.id)?;
        Ok(saved)
    }

    /// Which secrets are stored for a profile (never their values).
    pub fn stored_secrets(&self, id: &str) -> Result<StoredSecrets> {
        Ok(ConnectionSecrets::load(self.secrets.as_ref(), id)?.presence())
    }

    /// Connects with unsaved settings, reports the server and disconnects again.
    /// `existing_id` lets `Keep` secret updates fall back to stored values.
    pub async fn test(
        &self,
        config: &ConnectionConfig,
        existing_id: Option<&str>,
        updates: &SecretUpdates,
    ) -> Result<ServerInfo> {
        validate_config(config).map_err(ConnectionError::Invalid)?;
        let stored = match existing_id {
            Some(id) => ConnectionSecrets::load(self.secrets.as_ref(), id)?,
            None => ConnectionSecrets::default(),
        };
        let secrets = stored.with_updates(updates);
        let opened = open_client(config, &secrets, &self.known_hosts).await?;
        let info = fetch_server_info(&opened.client).await;
        opened.client.shutdown().immediate(true).await;
        Ok(info?)
    }

    /// Opens (or reuses) a live connection for a saved profile.
    pub async fn connect(&self, id: &str) -> Result<ActiveConnectionInfo> {
        if let Some(active) = self.registry.get(id).await {
            return Ok(active.info.clone());
        }
        let profile = self.repository.get(id)?;
        let secrets = ConnectionSecrets::load(self.secrets.as_ref(), id)?;
        let opened = open_client(&profile.config, &secrets, &self.known_hosts).await?;
        let server = match fetch_server_info(&opened.client).await {
            Ok(server) => server,
            Err(error) => {
                opened.client.shutdown().immediate(true).await;
                return Err(error.into());
            }
        };
        let info = ActiveConnectionInfo {
            connection_id: profile.id,
            server,
            via_ssh: opened.tunnel.is_some(),
        };
        self.registry
            .insert(ActiveConnection::new(
                opened.client,
                info.clone(),
                opened.tunnel,
            ))
            .await;
        tracing::info!(connection = %id, "connected");
        Ok(info)
    }

    /// Closes a live connection; disconnecting twice is not an error.
    pub async fn disconnect(&self, id: &str) {
        if self.registry.remove(id).await {
            tracing::info!(connection = %id, "disconnected");
        }
    }

    /// The driver client of a live connection.
    pub async fn client(&self, id: &str) -> Result<mongodb::Client> {
        self.registry
            .get(id)
            .await
            .map(|active| active.client.clone())
            .ok_or_else(|| ConnectionError::NotConnected(id.to_owned()))
    }

    /// All live connections.
    pub async fn active(&self) -> Vec<ActiveConnectionInfo> {
        self.registry.list().await
    }

    /// Stored secrets of a connection (for export only; never sent to the webview).
    pub(super) fn load_secrets(
        &self,
        id: &str,
    ) -> std::result::Result<ConnectionSecrets, SecretsError> {
        ConnectionSecrets::load(self.secrets.as_ref(), id)
    }

    /// Stores secrets for a connection (used by import).
    pub(super) fn store_secrets(
        &self,
        id: &str,
        secrets: &ConnectionSecrets,
    ) -> std::result::Result<(), SecretsError> {
        secrets.save(self.secrets.as_ref(), id)
    }

    /// Persists an already validated profile without touching secrets (used by import).
    pub(super) fn save_imported(&self, profile: ConnectionProfile) -> Result<ConnectionProfile> {
        self.repository.upsert(profile)
    }
}
