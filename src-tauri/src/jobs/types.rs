//! Job descriptions and events shared with the frontend.

use serde::Serialize;
use specta::Type;

use crate::error::AppError;

/// What a job does; picks the wording and icon in the jobs panel.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Type)]
#[serde(rename_all = "camelCase")]
pub enum JobKind {
    Dump,
    Restore,
    Export,
    Import,
    Copy,
}

/// Lifecycle of a job. Every state except `Running` is final.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Type)]
#[serde(rename_all = "camelCase")]
pub enum JobStatus {
    Running,
    Succeeded,
    Failed,
    Cancelled,
}

/// What `done` and `total` count.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Type)]
#[serde(rename_all = "camelCase")]
pub enum ProgressUnit {
    Documents,
    Bytes,
}

/// Progress of a running job.
#[derive(Debug, Clone, PartialEq, Serialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct JobProgress {
    pub done: f64,
    /// `None` when the total is unknown (the UI then shows an indeterminate bar).
    pub total: Option<f64>,
    pub unit: ProgressUnit,
    /// What is happening right now, e.g. "shop.orders".
    pub message: Option<String>,
}

/// Snapshot of a job, sent with every update.
#[derive(Debug, Clone, PartialEq, Serialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct JobInfo {
    pub id: String,
    pub kind: JobKind,
    /// Human-readable description, e.g. "Dump shop".
    pub title: String,
    pub connection_id: String,
    pub status: JobStatus,
    pub progress: Option<JobProgress>,
    /// The equivalent command line, without credentials.
    pub command: Option<String>,
    /// One-line result of a successful job.
    pub summary: Option<String>,
    pub error: Option<AppError>,
    /// Milliseconds since the Unix epoch.
    pub started_at: f64,
    pub finished_at: Option<f64>,
    /// Number of log lines written so far (the log itself is fetched on demand).
    pub log_lines: f64,
}

/// Emitted (at most a few times per second per job) when a job changes.
#[derive(Debug, Clone, Serialize, Type, tauri_specta::Event)]
#[serde(rename_all = "camelCase")]
pub struct JobUpdated {
    pub job: JobInfo,
}

/// New log lines of a job, batched like [`JobUpdated`].
#[derive(Debug, Clone, Serialize, Type, tauri_specta::Event)]
#[serde(rename_all = "camelCase")]
pub struct JobLogged {
    pub job_id: String,
    pub lines: Vec<String>,
}
