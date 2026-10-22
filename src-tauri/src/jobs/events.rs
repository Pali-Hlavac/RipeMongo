//! Publishes job changes to the webview as typed tauri-specta events.

use tauri::AppHandle;
use tauri_specta::Event;

use super::{JobEvents, JobInfo, JobLogged, JobUpdated};

/// [`JobEvents`] sink that emits [`JobUpdated`] and [`JobLogged`].
pub struct TauriJobEvents {
    app: AppHandle,
}

impl TauriJobEvents {
    pub fn new(app: AppHandle) -> Self {
        Self { app }
    }
}

impl JobEvents for TauriJobEvents {
    fn updated(&self, job: &JobInfo) {
        let event = JobUpdated { job: job.clone() };
        if let Err(error) = event.emit(&self.app) {
            tracing::warn!(%error, job = %job.id, "failed to emit job update");
        }
    }

    fn logged(&self, job_id: &str, lines: &[String]) {
        let event = JobLogged {
            job_id: job_id.to_owned(),
            lines: lines.to_vec(),
        };
        if let Err(error) = event.emit(&self.app) {
            tracing::warn!(%error, job = %job_id, "failed to emit job log");
        }
    }
}
