//! The job registry: starts work as tokio tasks, tracks their state and log, cancels them and
//! publishes throttled updates through a [`JobEvents`] sink.

use std::collections::{HashMap, VecDeque};
use std::future::Future;
use std::sync::{Arc, Mutex};
use std::time::Duration;

use tokio_util::sync::CancellationToken;

use super::state::{now_ms, Entry, Inner, JobContext};
use super::{JobInfo, JobKind, JobStatus, JobsError};
use crate::error::AppError;

/// How often pending changes of a running job are published.
const FLUSH_INTERVAL: Duration = Duration::from_millis(200);

/// Receives job changes; the app forwards them as Tauri events, tests collect them.
pub trait JobEvents: Send + Sync + 'static {
    fn updated(&self, job: &JobInfo);
    fn logged(&self, job_id: &str, lines: &[String]);
}

/// What to show for a job before it starts.
pub struct JobSpec {
    pub kind: JobKind,
    pub title: String,
    pub connection_id: String,
    pub command: Option<String>,
}

/// All jobs of this app session (in memory only).
#[derive(Clone)]
pub struct JobRegistry {
    inner: Arc<Inner>,
}

impl JobRegistry {
    pub fn new(events: Arc<dyn JobEvents>) -> Self {
        Self {
            inner: Arc::new(Inner {
                jobs: Mutex::new(HashMap::new()),
                events,
            }),
        }
    }

    /// Registers a job and runs `work` on the tokio runtime. `work` returns a one-line
    /// summary or the error that failed the job. Returns the job's first snapshot.
    pub fn start<F, Fut>(&self, spec: JobSpec, work: F) -> JobInfo
    where
        F: FnOnce(JobContext) -> Fut,
        Fut: Future<Output = Result<String, AppError>> + Send + 'static,
    {
        let id = uuid::Uuid::new_v4().to_string();
        let cancel = CancellationToken::new();
        let info = JobInfo {
            id: id.clone(),
            kind: spec.kind,
            title: spec.title,
            connection_id: spec.connection_id,
            status: JobStatus::Running,
            progress: None,
            command: spec.command,
            summary: None,
            error: None,
            started_at: now_ms(),
            finished_at: None,
            log_lines: 0.0,
        };
        self.inner.lock().insert(
            id.clone(),
            Entry {
                info: info.clone(),
                log: VecDeque::new(),
                pending: Vec::new(),
                dirty: false,
                cancel: cancel.clone(),
            },
        );
        self.inner.events.updated(&info);

        let work = work(JobContext {
            id: id.clone(),
            inner: Arc::clone(&self.inner),
            cancel,
        });
        let inner = Arc::clone(&self.inner);
        tokio::spawn(async move {
            let flusher = tokio::spawn({
                let (inner, id) = (Arc::clone(&inner), id.clone());
                async move {
                    let mut interval = tokio::time::interval(FLUSH_INTERVAL);
                    loop {
                        interval.tick().await;
                        inner.flush(&id);
                    }
                }
            });
            let result = work.await;
            flusher.abort();
            inner.finish(&id, result);
        });
        info
    }

    /// Every job, newest first.
    pub fn list(&self) -> Vec<JobInfo> {
        let mut jobs: Vec<JobInfo> = self
            .inner
            .lock()
            .values()
            .map(|entry| entry.info.clone())
            .collect();
        jobs.sort_by(|a, b| b.started_at.total_cmp(&a.started_at));
        jobs
    }

    /// The kept log lines of a job.
    pub fn log(&self, id: &str) -> Result<Vec<String>, JobsError> {
        self.inner
            .lock()
            .get(id)
            .map(|entry| entry.log.iter().cloned().collect())
            .ok_or(JobsError::NotFound)
    }

    /// Asks a job to stop. Cancelling a finished job does nothing.
    pub fn cancel(&self, id: &str) -> Result<(), JobsError> {
        let jobs = self.inner.lock();
        let entry = jobs.get(id).ok_or(JobsError::NotFound)?;
        entry.cancel.cancel();
        Ok(())
    }

    /// Forgets a finished job.
    pub fn dismiss(&self, id: &str) -> Result<(), JobsError> {
        let mut jobs = self.inner.lock();
        match jobs.get(id) {
            None => Err(JobsError::NotFound),
            Some(entry) if entry.info.status == JobStatus::Running => Err(JobsError::Running),
            Some(_) => {
                jobs.remove(id);
                Ok(())
            }
        }
    }
}
