//! Restore jobs: run `mongorestore` with a dump folder or archive, after reading what the dump
//! contains.

mod archive;
mod contents;
mod progress;
mod request;
#[cfg(test)]
mod tests;

pub use contents::{inspect_dump, DumpContents, DumpNamespace, RestoreSource};
pub use progress::RestoreProgress;
pub use request::{DatabaseRename, RestoreRequest};

use super::run::{run_tool, Invocation};
use super::{display_command, CredentialsFile, Tool, ToolsError};
use crate::connections::ToolConnection;
use crate::jobs::{JobInfo, JobKind, JobRegistry, JobSpec};

/// Starts a restore job. `contents` is what [`inspect_dump`] found in the source (it decides
/// `--gzip`). `connection` stays alive (with its tunnel) until the restore ends.
pub fn start_restore(
    jobs: &JobRegistry,
    connection_id: String,
    connection: ToolConnection,
    request: RestoreRequest,
    contents: &DumpContents,
) -> Result<JobInfo, ToolsError> {
    if request.oplog_replay && !contents.oplog {
        return Err(ToolsError::Invalid(
            "This dump has no oplog to replay. Make it with the point-in-time option.".into(),
        ));
    }
    let args = request.args(contents.gzip)?;
    let credentials = CredentialsFile::new(connection.uri()).map_err(ToolsError::Credentials)?;
    let spec = JobSpec {
        kind: JobKind::Restore,
        title: request.title(),
        connection_id,
        command: Some(display_command(
            Tool::Mongorestore,
            connection.display_uri(),
            &args,
        )),
    };
    Ok(jobs.start(spec, move |ctx| async move {
        // Keeps the connection (and its SSH tunnel) open for the tool.
        let _connection = connection;
        let mut progress = RestoreProgress::default();
        let invocation = Invocation {
            tool: Tool::Mongorestore,
            args,
            credentials,
        };
        run_tool(&ctx, invocation, &mut progress).await?;
        Ok(progress.summary(request.dry_run))
    }))
}
