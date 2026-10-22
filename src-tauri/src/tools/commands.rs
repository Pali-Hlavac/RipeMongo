//! Tauri boundary for the bundled tools.

use tauri::State;

use super::dump::{start_dump as start_dump_job, DumpRequest};
use super::{tools_info, ToolsInfo};
use crate::connections::ConnectionManager;
use crate::error::CommandResult;
use crate::jobs::{JobInfo, JobRegistry};

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
    Ok(start_dump_job(&jobs, connection_id, connection, request)?)
}
