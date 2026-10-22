//! Tauri boundary for background jobs. Jobs are started by their feature's command
//! (for example `start_dump`); these commands observe and control them.

use tauri::State;

use super::{JobInfo, JobRegistry};
use crate::error::CommandResult;

/// Every job of this session, newest first.
#[tauri::command]
#[specta::specta]
pub fn list_jobs(jobs: State<'_, JobRegistry>) -> Vec<JobInfo> {
    jobs.list()
}

/// The log lines kept for a job.
#[tauri::command]
#[specta::specta]
pub fn get_job_log(jobs: State<'_, JobRegistry>, job_id: String) -> CommandResult<Vec<String>> {
    Ok(jobs.log(&job_id)?)
}

/// Asks a running job to stop; a tool process is killed.
#[tauri::command]
#[specta::specta]
pub fn cancel_job(jobs: State<'_, JobRegistry>, job_id: String) -> CommandResult<()> {
    Ok(jobs.cancel(&job_id)?)
}

/// Removes a finished job from the list.
#[tauri::command]
#[specta::specta]
pub fn dismiss_job(jobs: State<'_, JobRegistry>, job_id: String) -> CommandResult<()> {
    Ok(jobs.dismiss(&job_id)?)
}
