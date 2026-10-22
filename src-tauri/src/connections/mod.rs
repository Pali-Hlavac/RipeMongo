//! Saved connections, connection strings, secrets and live MongoDB clients.

mod client;
pub mod commands;
mod config;
mod error;
mod registry;
mod repository;
mod secrets;
mod server_info;
mod service;
pub mod transfer;
mod types;
pub mod uri;
mod validation;

pub use config::*;
pub use error::ConnectionError;
pub use registry::ActiveConnectionInfo;
pub use secrets::{
    delete_all as delete_secrets, ConnectionSecrets, SecretUpdate, SecretUpdates, StoredSecrets,
};
pub use server_info::{fetch_server_info, ServerInfo, TopologyKind};
pub use service::ConnectionManager;
pub use types::{ConnectionColor, ConnectionProfile};
pub use validation::{validate_config, validate_profile};

use std::sync::Arc;

use tauri::{App, Manager};

use crate::secrets::{KeyringSecretStore, KEYCHAIN_SERVICE};

/// Registers the [`ConnectionManager`] backed by the OS keychain.
pub fn init(app: &App) -> tauri::Result<()> {
    let config_dir = app.path().app_config_dir()?;
    let secrets = Arc::new(KeyringSecretStore::new(KEYCHAIN_SERVICE));
    app.manage(ConnectionManager::new(&config_dir, secrets));
    Ok(())
}
