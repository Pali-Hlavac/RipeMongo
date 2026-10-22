//! User preferences persisted as JSON in the platform app-config directory.

pub mod commands;
mod error;
mod service;
mod types;

pub use error::SettingsError;
pub use service::SettingsStore;
pub use types::Settings;

use tauri::{App, Manager};

/// File name of the settings document inside the app-config directory.
const SETTINGS_FILE_NAME: &str = "settings.json";

/// Registers a [`SettingsStore`] pointing at the platform config directory.
pub fn init(app: &App) -> tauri::Result<()> {
    let path = app.path().app_config_dir()?.join(SETTINGS_FILE_NAME);
    app.manage(SettingsStore::new(path));
    Ok(())
}
