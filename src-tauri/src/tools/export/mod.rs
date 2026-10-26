//! Export jobs: run `mongoexport` for one collection or view into a JSON or CSV file.

mod progress;
mod request;
#[cfg(test)]
mod tests;

pub use progress::ExportProgress;
pub use request::{ExportFormat, ExportRequest};

use super::run::{run_tool, Invocation};
use super::{display_command, CredentialsFile, Tool, ToolsError};
use crate::connections::ToolConnection;
use crate::jobs::{JobInfo, JobKind, JobRegistry, JobSpec};

/// Starts an export job. `connection` stays alive (with its tunnel) until the export ends.
pub fn start_export(
    jobs: &JobRegistry,
    connection_id: String,
    connection: ToolConnection,
    request: ExportRequest,
) -> Result<JobInfo, ToolsError> {
    let args = request.args()?;
    let credentials = CredentialsFile::new(&connection).map_err(ToolsError::Credentials)?;
    let spec = JobSpec {
        kind: JobKind::Export,
        title: request.title(),
        connection_id,
        command: Some(display_command(
            Tool::Mongoexport,
            connection.display_uri(),
            &args,
        )),
    };
    Ok(jobs.start(spec, move |ctx| async move {
        // Keeps the connection (and its SSH tunnel) open for the tool.
        let _connection = connection;
        let mut progress = ExportProgress::default();
        let invocation = Invocation {
            tool: Tool::Mongoexport,
            args,
            credentials,
            input: None,
        };
        run_tool(&ctx, invocation, &mut progress).await?;
        Ok(progress.summary(request.path.trim()))
    }))
}
