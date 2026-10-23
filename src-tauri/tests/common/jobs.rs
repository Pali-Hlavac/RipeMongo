//! Helpers for tests that run tool jobs: a registry without UI events and a dump runner.

use std::sync::Arc;
use std::time::Duration;

use ripemongo_lib::connections::ConnectionManager;
use ripemongo_lib::jobs::{JobEvents, JobInfo, JobRegistry, JobStatus};
use ripemongo_lib::tools::dump::{start_dump, DumpRequest};
use ripemongo_lib::tools::{locate, Tool};

use super::ROOT_PASSWORD;

/// How long a dump of a few hundred documents may take.
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
