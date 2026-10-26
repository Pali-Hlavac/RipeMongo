//! Helpers for tests that run tool jobs: a registry without UI events, dump, restore, export,
//! import and copy runners.

use std::sync::Arc;
use std::time::Duration;

use ripemongo_lib::connections::ConnectionManager;
use ripemongo_lib::jobs::{JobEvents, JobInfo, JobRegistry, JobStatus};
use ripemongo_lib::tools::copy::{start_copy, CopyEnd, CopyRequest};
use ripemongo_lib::tools::dump::{start_dump, DumpRequest};
use ripemongo_lib::tools::export::{start_export, ExportRequest};
use ripemongo_lib::tools::import::{start_import, ImportRequest};
use ripemongo_lib::tools::restore::{inspect_dump, start_restore, RestoreRequest};
use ripemongo_lib::tools::ToolsError;
use ripemongo_lib::tools::{locate, Tool};

use super::ROOT_PASSWORD;

/// How long a dump or restore of a few hundred documents may take.
const JOB_TIMEOUT: Duration = Duration::from_secs(60);
const POLL_INTERVAL: Duration = Duration::from_millis(50);

struct NoEvents;

impl JobEvents for NoEvents {
    fn updated(&self, _job: &JobInfo) {}
    fn logged(&self, _job_id: &str, _lines: &[String]) {}
}

/// A job registry that sends no events.
pub fn registry() -> JobRegistry {
    JobRegistry::new(Arc::new(NoEvents))
}

/// False (with a message) when `pnpm sidecars` has not fetched the tools.
pub fn tools_available() -> bool {
    let found = locate(Tool::Mongodump).is_ok();
    if !found {
        eprintln!("skipped: run `pnpm sidecars` to fetch the MongoDB tools");
    }
    found
}

/// Waits until a job is no longer running.
pub async fn finished(jobs: &JobRegistry, id: &str) -> JobInfo {
    tokio::time::timeout(JOB_TIMEOUT, async {
        loop {
            let job = jobs
                .list()
                .into_iter()
                .find(|job| job.id == id)
                .expect("job is listed");
            if job.status != JobStatus::Running {
                return job;
            }
            tokio::time::sleep(POLL_INTERVAL).await;
        }
    })
    .await
    .expect("job finished in time")
}

/// Runs a dump on an open connection to the end; checks the displayed command has no password.
pub async fn dump(
    manager: &ConnectionManager,
    jobs: &JobRegistry,
    id: &str,
    request: DumpRequest,
) -> JobInfo {
    let connection = manager.tool_connection(id).await.expect("connection");
    let started = start_dump(jobs, id.to_owned(), connection, request, None).expect("dump started");
    let command = started.command.expect("command");
    assert!(command.starts_with("mongodump --uri="), "{command}");
    assert!(!command.contains(ROOT_PASSWORD), "{command}");
    finished(jobs, &started.id).await
}

/// Runs a restore on an open connection to the end.
pub async fn restore(
    manager: &ConnectionManager,
    jobs: &JobRegistry,
    id: &str,
    request: RestoreRequest,
) -> JobInfo {
    let contents = inspect_dump(&request.source).expect("dump contents");
    let connection = manager.tool_connection(id).await.expect("connection");
    let started = start_restore(jobs, id.to_owned(), connection, request, &contents)
        .expect("restore started");
    let command = started.command.expect("command");
    assert!(command.starts_with("mongorestore --uri="), "{command}");
    finished(jobs, &started.id).await
}

/// Runs an export on an open connection to the end.
pub async fn export(
    manager: &ConnectionManager,
    jobs: &JobRegistry,
    id: &str,
    request: ExportRequest,
) -> JobInfo {
    let connection = manager.tool_connection(id).await.expect("connection");
    let started = start_export(jobs, id.to_owned(), connection, request).expect("export started");
    let command = started.command.expect("command");
    assert!(command.starts_with("mongoexport --uri="), "{command}");
    finished(jobs, &started.id).await
}

/// Runs an import on an open connection to the end.
pub async fn import(
    manager: &ConnectionManager,
    jobs: &JobRegistry,
    id: &str,
    request: ImportRequest,
) -> JobInfo {
    let connection = manager.tool_connection(id).await.expect("connection");
    let started = start_import(jobs, id.to_owned(), connection, request).expect("import started");
    let command = started.command.expect("command");
    assert!(command.starts_with("mongoimport --uri="), "{command}");
    finished(jobs, &started.id).await
}

/// Starts a copy between two open connections; the error when it is refused up front.
pub async fn start_copy_job(
    manager: &ConnectionManager,
    jobs: &JobRegistry,
    (source, target): (&str, &str),
    request: CopyRequest,
) -> Result<JobInfo, ToolsError> {
    let name = (source != target).then(|| "Target".to_owned());
    let source = copy_end(manager, source).await;
    let target = copy_end(manager, target).await;
    start_copy(jobs, source, target, request, name).await
}

async fn copy_end(manager: &ConnectionManager, id: &str) -> CopyEnd {
    CopyEnd {
        connection_id: id.to_owned(),
        connection: manager.tool_connection(id).await.expect("connection"),
    }
}

/// Runs a copy between two open connections to the end; checks the displayed command.
pub async fn copy(
    manager: &ConnectionManager,
    jobs: &JobRegistry,
    ends: (&str, &str),
    request: CopyRequest,
) -> JobInfo {
    let started = start_copy_job(manager, jobs, ends, request)
        .await
        .expect("copy started");
    let command = started.command.expect("command");
    assert!(command.starts_with("mongodump --uri="), "{command}");
    assert!(command.contains(" | mongorestore --uri="), "{command}");
    assert!(!command.contains(ROOT_PASSWORD), "{command}");
    finished(jobs, &started.id).await
}
