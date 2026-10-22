//! Query history and favorite queries per collection, stored in the app-config directory.

pub mod commands;
mod error;
mod service;
#[cfg(test)]
mod tests;
mod types;

pub use error::QueryHistoryError;
pub use service::{Namespace, QueryHistory, MAX_FAVORITES, MAX_RECENT};
pub use types::*;

use tauri::{App, Manager};

/// File name of the history document inside the app-config directory.
const HISTORY_FILE_NAME: &str = "query-history.json";

/// Registers the [`QueryHistory`] store as managed state.
pub fn init(app: &App) -> tauri::Result<()> {
    let path = app.path().app_config_dir()?.join(HISTORY_FILE_NAME);
    app.manage(QueryHistory::new(path));
    Ok(())
}
