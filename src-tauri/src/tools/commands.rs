//! Tauri boundary for the bundled tools.

use tauri::State;

use super::copy::{start_copy as start_copy_job, CopyEnd, CopyRequest};
use super::dump::{start_dump as start_dump_job, DumpRequest};
use super::export::{start_export as start_export_job, ExportRequest};
use super::import::{
    inspect_import_file as inspect_file, start_import as start_import_job, ImportPreview,
    ImportRequest,
};
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

/// Starts `mongoexport` as a background job on an open connection.
#[tauri::command]
#[specta::specta]
pub async fn start_export(
    manager: State<'_, ConnectionManager>,
    jobs: State<'_, JobRegistry>,
    connection_id: String,
    request: ExportRequest,
) -> CommandResult<JobInfo> {
    let connection = manager.tool_connection(&connection_id).await?;
    Ok(start_export_job(&jobs, connection_id, connection, request)?)
}

/// Reads the start of a file to import: its format, and for delimited text the delimiter,
/// columns, sample values and suggested types. `delimiter` overrides the detected one.
#[tauri::command]
#[specta::specta]
pub async fn inspect_import_file(
    path: String,
    delimiter: Option<String>,
) -> CommandResult<ImportPreview> {
    tokio::task::spawn_blocking(move || inspect_file(&path, delimiter.as_deref()))
        .await
        .map_err(|error| AppError::new(ErrorCode::Internal, error.to_string()))?
        .map_err(Into::into)
}

/// Starts `mongoimport` as a background job on an open connection.
#[tauri::command]
#[specta::specta]
pub async fn start_import(
    manager: State<'_, ConnectionManager>,
    jobs: State<'_, JobRegistry>,
    connection_id: String,
    request: ImportRequest,
) -> CommandResult<JobInfo> {
    let connection = manager.tool_connection(&connection_id).await?;
    Ok(start_import_job(&jobs, connection_id, connection, request)?)
}

/// Starts a copy of a database or collection (`mongodump` piped into `mongorestore`) from an
/// open connection into another open connection, or into the same one under another name.
#[tauri::command]
#[specta::specta]
pub async fn start_copy(
    manager: State<'_, ConnectionManager>,
    jobs: State<'_, JobRegistry>,
    connection_id: String,
    target_connection_id: String,
    request: CopyRequest,
) -> CommandResult<JobInfo> {
    let source = manager.tool_connection(&connection_id).await?;
    let target = manager.tool_connection(&target_connection_id).await?;
    let target_name = if connection_id == target_connection_id {
        None
    } else {
        manager
            .list()?
            .into_iter()
            .find(|profile| profile.id == target_connection_id)
            .map(|profile| profile.name)
    };
    let source = CopyEnd {
        connection_id,
        connection: source,
    };
    let target = CopyEnd {
        connection_id: target_connection_id,
        connection: target,
    };
    Ok(start_copy_job(&jobs, source, target, request, target_name).await?)
}
