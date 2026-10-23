//! Tauri boundary for saved dumps.

use std::collections::HashMap;

use tauri::State;

use super::{DumpProfile, DumpProfileInput, DumpProfiles, DumpProfilesError};
use crate::connections::ConnectionManager;
use crate::error::CommandResult;
use crate::jobs::{JobInfo, JobRegistry};
use crate::tools::dump::start_dump;

/// Names of the saved connections by id.
fn connection_names(manager: &ConnectionManager) -> CommandResult<HashMap<String, String>> {
    Ok(manager
        .list()?
        .into_iter()
        .map(|profile| (profile.id, profile.name))
        .collect())
}

/// Every saved dump whose connection still exists.
#[tauri::command]
#[specta::specta]
pub async fn list_dump_profiles(
    manager: State<'_, ConnectionManager>,
    store: State<'_, DumpProfiles>,
) -> CommandResult<Vec<DumpProfile>> {
    let names = connection_names(&manager)?;
    Ok(store
        .list()?
        .into_iter()
        .filter_map(|profile| {
            let name = names.get(&profile.connection_id)?.clone();
            Some(DumpProfile::new(profile, name))
        })
        .collect())
}

/// Creates or updates a saved dump.
#[tauri::command]
#[specta::specta]
pub async fn save_dump_profile(
    manager: State<'_, ConnectionManager>,
    store: State<'_, DumpProfiles>,
    profile: DumpProfileInput,
) -> CommandResult<DumpProfile> {
    let names = connection_names(&manager)?;
    let Some(name) = names.get(&profile.connection_id) else {
        return Err(DumpProfilesError::Invalid("This connection no longer exists.".into()).into());
    };
    Ok(DumpProfile::new(store.save(profile)?, name.clone()))
}

/// Deletes a saved dump.
#[tauri::command]
#[specta::specta]
pub async fn delete_dump_profile(store: State<'_, DumpProfiles>, id: String) -> CommandResult<()> {
    Ok(store.delete(&id)?)
}

/// Starts a saved dump as a background job; its connection must be open.
#[tauri::command]
#[specta::specta]
pub async fn run_dump_profile(
    manager: State<'_, ConnectionManager>,
    jobs: State<'_, JobRegistry>,
    store: State<'_, DumpProfiles>,
    id: String,
) -> CommandResult<JobInfo> {
    let profile = store.get(&id)?;
    let connection = manager.tool_connection(&profile.connection_id).await?;
    let job = start_dump(
        &jobs,
        profile.connection_id,
        connection,
        profile.request,
        Some(&profile.name),
    )?;
    // The dump is running either way; a missing "last run" date is not worth failing it.
    if let Err(error) = store.mark_run(&id) {
        tracing::warn!(%error, "could not record when a saved dump ran");
    }
    Ok(job)
}
