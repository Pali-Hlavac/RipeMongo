//! Background jobs: long-running work (dump, restore, import, export, copy) that runs as a
//! cancellable tokio task and reports progress and log lines through Tauri events.
//! See `docs/architecture/background-jobs.md` and ADR 0010.

pub mod commands;
mod error;
mod events;
mod registry;
mod state;
#[cfg(test)]
mod tests;
mod types;

pub use error::JobsError;
pub use registry::{JobEvents, JobRegistry, JobSpec};
pub use state::JobContext;
pub use types::*;

use std::sync::Arc;

use tauri::{App, Manager};

/// Registers the [`JobRegistry`], publishing changes as Tauri events.
pub fn init(app: &App) {
    let events = events::TauriJobEvents::new(app.handle().clone());
    app.manage(JobRegistry::new(Arc::new(events)));
}
