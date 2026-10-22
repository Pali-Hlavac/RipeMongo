//! Tauri boundary for reading and updating user settings.

use tauri::State;

use super::{Settings, SettingsStore};
use crate::error::CommandResult;

/// Returns the persisted settings, or defaults on first launch.
#[tauri::command]
#[specta::specta]
pub async fn get_settings(store: State<'_, SettingsStore>) -> CommandResult<Settings> {
    Ok(store.load()?)
}

/// Replaces the persisted settings and returns what was saved.
#[tauri::command]
#[specta::specta]
pub async fn update_settings(
    store: State<'_, SettingsStore>,
    settings: Settings,
) -> CommandResult<Settings> {
    store.save(&settings)?;
    Ok(settings)
}
