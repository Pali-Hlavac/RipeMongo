//! Unit tests of the job registry (no Tauri: events are recorded in memory).

use std::sync::{Arc, Mutex};
use std::time::Duration;

use super::*;
use crate::error::{AppError, ErrorCode};

/// How long a test waits for a job to finish.
const WAIT: Duration = Duration::from_secs(5);

#[derive(Default)]
struct Recorded {
    updates: Mutex<Vec<JobInfo>>,
    lines: Mutex<Vec<String>>,
}

impl JobEvents for Recorded {
    fn updated(&self, job: &JobInfo) {
        self.updates.lock().unwrap().push(job.clone());
    }

    fn logged(&self, _job_id: &str, lines: &[String]) {
        self.lines.lock().unwrap().extend_from_slice(lines);
    }
}

fn registry() -> (JobRegistry, Arc<Recorded>) {
    let recorded = Arc::new(Recorded::default());
    (JobRegistry::new(recorded.clone()), recorded)
}

fn spec() -> JobSpec {
    JobSpec {
        kind: JobKind::Dump,
        title: "Dump shop".into(),
        connection_id: "c1".into(),
        command: Some("mongodump --db=shop".into()),
    }
}

async fn finished(jobs: &JobRegistry, id: &str) -> JobInfo {
    tokio::time::timeout(WAIT, async {
        loop {
            let job = jobs.list().into_iter().find(|job| job.id == id).unwrap();
            if job.status != JobStatus::Running {
                return job;
            }
            tokio::time::sleep(Duration::from_millis(10)).await;
        }
    })
    .await
    .unwrap()
}

#[tokio::test]
async fn successful_job_reports_progress_log_and_summary() {
    let (jobs, recorded) = registry();
    let started = jobs.start(spec(), |ctx| async move {
        ctx.log("writing shop.items");
        ctx.progress(JobProgress {
            done: 5.0,
            total: Some(10.0),
            unit: ProgressUnit::Documents,
            message: Some("shop.items".into()),
        });
        ctx.log("done dumping shop.items");
        Ok("Dumped 1 collection".into())
    });
    assert_eq!(started.status, JobStatus::Running);
    assert_eq!(started.command.as_deref(), Some("mongodump --db=shop"));

    let job = finished(&jobs, &started.id).await;
    assert_eq!(job.status, JobStatus::Succeeded);
    assert_eq!(job.summary.as_deref(), Some("Dumped 1 collection"));
    assert_eq!(job.progress.unwrap().done, 5.0);
    assert_eq!(job.log_lines, 2.0);
    assert!(job.finished_at.is_some());
    assert_eq!(jobs.log(&started.id).unwrap().len(), 2);
    assert_eq!(recorded.lines.lock().unwrap().len(), 2);
    let updates = recorded.updates.lock().unwrap();
    assert_eq!(updates.first().unwrap().status, JobStatus::Running);
    assert_eq!(updates.last().unwrap().status, JobStatus::Succeeded);
}

#[tokio::test]
async fn failed_job_keeps_the_error() {
    let (jobs, _) = registry();
    let started = jobs.start(spec(), |_| async {
        Err(AppError::new(
            ErrorCode::OperationFailed,
            "mongodump failed",
        ))
    });
    let job = finished(&jobs, &started.id).await;
    assert_eq!(job.status, JobStatus::Failed);
    assert_eq!(job.error.unwrap().message, "mongodump failed");
}

#[tokio::test]
async fn cancelling_stops_the_work_and_finished_jobs_can_be_dismissed() {
    let (jobs, _) = registry();
    let started = jobs.start(spec(), |ctx| async move {
        ctx.cancellation().cancelled().await;
        Err(AppError::new(ErrorCode::OperationFailed, "killed"))
    });
    let error = jobs.dismiss(&started.id).unwrap_err();
    assert!(matches!(error, JobsError::Running));

    jobs.cancel(&started.id).unwrap();
    let job = finished(&jobs, &started.id).await;
    assert_eq!(job.status, JobStatus::Cancelled);
    assert!(job.error.is_none());

    jobs.dismiss(&started.id).unwrap();
    assert!(jobs.list().is_empty());
    assert!(matches!(jobs.cancel(&started.id), Err(JobsError::NotFound)));
}

#[tokio::test]
async fn long_logs_keep_the_latest_lines() {
    let (jobs, _) = registry();
    let started = jobs.start(spec(), |ctx| async move {
        for index in 0..10_005 {
            ctx.log(&format!("line {index}"));
        }
        Ok(String::new())
    });
    let job = finished(&jobs, &started.id).await;
    assert_eq!(job.log_lines, 10_005.0);
    let log = jobs.log(&started.id).unwrap();
    assert_eq!(log.len(), 10_000);
    assert_eq!(log[0], "line 5");
}
