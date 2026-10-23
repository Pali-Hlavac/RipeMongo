//! Tauri boundary for the bundled tools.

use tauri::State;

use super::dump::{start_dump as start_dump_job, DumpRequest};
use super::restore::{
    inspect_dump as inspect, start_restore as start_restore_job, DumpContents, RestoreRequest,
    RestoreSource,
};
use super::{tools_info, ToolsInfo};
use crate::connections::ConnectionManager;
use crate::error::{AppError, CommandResult, ErrorCode};
use crate::jobs::{JobInfo, JobRegistry};

/// Reads a dump off the async runtime (it may decompress an archive's prelude).
async fn read_contents(source: RestoreSource) -> CommandResult<DumpContents> {
    tokio::task::spawn_blocking(move || inspect(&source))
        .await
        .map_err(|error| AppError::new(ErrorCode::Internal, error.to_string()))?
        .map_err(Into::into)
}

/// Which bundled tools are available, with their versions.
#[tauri::command]
#[specta::specta]
pub async fn get_tools_info() -> ToolsInfo {
    tools_info().await
}

/// Starts `mongodump` as a background job on an open connection.
#[tauri::command]
#[specta::specta]
pub async fn start_dump(
    manager: State<'_, ConnectionManager>,
    jobs: State<'_, JobRegistry>,
    connection_id: String,
    request: DumpRequest,
) -> CommandResult<JobInfo> {
    let connection = manager.tool_connection(&connection_id).await?;
    Ok(start_dump_job(
        &jobs,
        connection_id,
        connection,
        request,
        None,
    )?)
}

/// What a dump folder or archive contains: databases, collections, gzip and oplog.
#[tauri::command]
#[specta::specta]
pub async fn inspect_dump(source: RestoreSource) -> CommandResult<DumpContents> {
    read_contents(source).await
}

/// Starts `mongorestore` as a background job on an open connection.
#[tauri::command]
#[specta::specta]
pub async fn start_restore(
    manager: State<'_, ConnectionManager>,
    jobs: State<'_, JobRegistry>,
    connection_id: String,
    request: RestoreRequest,
) -> CommandResult<JobInfo> {
    let contents = read_contents(request.source.clone()).await?;
    let connection = manager.tool_connection(&connection_id).await?;
    Ok(start_restore_job(
        &jobs,
        connection_id,
        connection,
        request,
        &contents,
    )?)
}
