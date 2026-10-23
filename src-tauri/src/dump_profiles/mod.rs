//! Saved dumps: named dump settings of a connection, re-run with one click. Stored in the
//! app-config directory.

pub mod commands;
mod error;
mod service;
#[cfg(test)]
mod tests;
mod types;

pub use error::DumpProfilesError;
pub use service::{DumpProfiles, MAX_PROFILES};
pub use types::*;

use tauri::{App, Manager};

/// File name of the saved dumps inside the app-config directory.
const PROFILES_FILE_NAME: &str = "dump-profiles.json";

/// Registers the [`DumpProfiles`] store as managed state.
pub fn init(app: &App) -> tauri::Result<()> {
    let path = app.path().app_config_dir()?.join(PROFILES_FILE_NAME);
    app.manage(DumpProfiles::new(path));
    Ok(())
}
