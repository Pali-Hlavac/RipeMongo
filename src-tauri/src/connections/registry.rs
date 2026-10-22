//! Live connections: one driver client (and optional SSH tunnel) per connected profile.

use std::collections::HashMap;
use std::sync::Arc;

use mongodb::Client;
use serde::Serialize;
use specta::Type;
use tokio::sync::RwLock;

use super::ServerInfo;
use crate::ssh::SshTunnel;

/// Public description of a live connection.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct ActiveConnectionInfo {
    pub connection_id: String,
    pub server: ServerInfo,
    pub via_ssh: bool,
}

/// A connected client. The tunnel is kept alive for as long as the client exists.
pub struct ActiveConnection {
    pub client: Client,
    pub info: ActiveConnectionInfo,
    _tunnel: Option<SshTunnel>,
}

impl ActiveConnection {
    pub fn new(client: Client, info: ActiveConnectionInfo, tunnel: Option<SshTunnel>) -> Self {
        Self {
            client,
            info,
            _tunnel: tunnel,
        }
    }
}

/// Thread-safe map of connection id → live connection.
#[derive(Default)]
pub struct ConnectionRegistry {
    active: RwLock<HashMap<String, Arc<ActiveConnection>>>,
}

impl ConnectionRegistry {
    /// Registers a connection, replacing (and closing) any previous one with the same id.
    pub async fn insert(&self, connection: ActiveConnection) {
        let id = connection.info.connection_id.clone();
        let previous = self.active.write().await.insert(id, Arc::new(connection));
        if let Some(previous) = previous {
            close(previous).await;
        }
    }

    /// Closes and forgets a connection. Returns `false` if it was not connected.
    pub async fn remove(&self, id: &str) -> bool {
        let removed = self.active.write().await.remove(id);
        let was_connected = removed.is_some();
        if let Some(connection) = removed {
            close(connection).await;
        }
        was_connected
    }

    pub async fn get(&self, id: &str) -> Option<Arc<ActiveConnection>> {
        self.active.read().await.get(id).cloned()
    }

    pub async fn list(&self) -> Vec<ActiveConnectionInfo> {
        self.active
            .read()
            .await
            .values()
            .map(|connection| connection.info.clone())
            .collect()
    }
}

async fn close(connection: Arc<ActiveConnection>) {
    connection.client.clone().shutdown().immediate(true).await;
}
