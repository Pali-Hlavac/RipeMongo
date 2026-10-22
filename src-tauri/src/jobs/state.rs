//! Shared job state behind the registry: entries with their log, throttled publishing, and
//! the [`JobContext`] handed to running work.

use std::collections::{HashMap, VecDeque};
use std::sync::{Arc, Mutex, MutexGuard};
use std::time::{SystemTime, UNIX_EPOCH};

use tokio_util::sync::CancellationToken;

use super::{JobEvents, JobInfo, JobProgress, JobStatus};
use crate::error::AppError;

/// Log lines kept per job; older lines are dropped.
const MAX_LOG_LINES: usize = 10_000;
/// Longer log lines are cut (a tool can print whole documents on errors).
const MAX_LINE_CHARS: usize = 2_000;
/// Finished jobs kept until dismissed; the oldest are forgotten first.
const MAX_FINISHED_JOBS: usize = 50;

pub(super) struct Entry {
    pub(super) info: JobInfo,
    pub(super) log: VecDeque<String>,
    pub(super) pending: Vec<String>,
    pub(super) dirty: bool,
    pub(super) cancel: CancellationToken,
}

pub(super) struct Inner {
    pub(super) jobs: Mutex<HashMap<String, Entry>>,
    pub(super) events: Arc<dyn JobEvents>,
}

impl Inner {
    pub(super) fn lock(&self) -> MutexGuard<'_, HashMap<String, Entry>> {
        // A panic while holding the lock cannot leave the map inconsistent.
        self.jobs
            .lock()
            .unwrap_or_else(|poisoned| poisoned.into_inner())
    }

    pub(super) fn update(&self, id: &str, change: impl FnOnce(&mut Entry)) {
        if let Some(entry) = self.lock().get_mut(id) {
            change(entry);
            entry.dirty = true;
        }
    }

    /// Publishes pending log lines and the current snapshot, if anything changed.
    pub(super) fn flush(&self, id: &str) {
        let (info, lines) = {
            let mut jobs = self.lock();
            let Some(entry) = jobs.get_mut(id).filter(|entry| entry.dirty) else {
                return;
            };
            entry.dirty = false;
            (entry.info.clone(), std::mem::take(&mut entry.pending))
        };
        if !lines.is_empty() {
            self.events.logged(id, &lines);
        }
        self.events.updated(&info);
    }

    pub(super) fn finish(&self, id: &str, result: Result<String, AppError>) {
        self.update(id, |entry| {
            let info = &mut entry.info;
            info.finished_at = Some(now_ms());
            match result {
                // Work that completed before it noticed the cancellation still succeeded.
                Ok(summary) => {
                    info.status = JobStatus::Succeeded;
                    info.summary = Some(summary);
                }
                Err(_) if entry.cancel.is_cancelled() => info.status = JobStatus::Cancelled,
                Err(error) => {
                    info.status = JobStatus::Failed;
                    info.error = Some(error);
                }
            }
        });
        self.flush(id);
        self.prune();
    }

    fn prune(&self) {
        let mut jobs = self.lock();
        let mut finished: Vec<(f64, String)> = jobs
            .values()
            .filter(|entry| entry.info.status != JobStatus::Running)
            .map(|entry| (entry.info.started_at, entry.info.id.clone()))
            .collect();
        if finished.len() <= MAX_FINISHED_JOBS {
            return;
        }
        finished.sort_by(|a, b| a.0.total_cmp(&b.0));
        for (_, id) in finished.iter().take(finished.len() - MAX_FINISHED_JOBS) {
            jobs.remove(id);
        }
    }
}

/// Handle given to running work to report progress and notice cancellation.
#[derive(Clone)]
pub struct JobContext {
    pub(super) id: String,
    pub(super) inner: Arc<Inner>,
    pub(super) cancel: CancellationToken,
}

impl JobContext {
    pub fn progress(&self, progress: JobProgress) {
        self.inner
            .update(&self.id, |entry| entry.info.progress = Some(progress));
    }

    /// Appends a line to the job log.
    pub fn log(&self, line: &str) {
        let line: String = line.chars().take(MAX_LINE_CHARS).collect();
        self.inner.update(&self.id, |entry| {
            if entry.log.len() == MAX_LOG_LINES {
                entry.log.pop_front();
            }
            entry.log.push_back(line.clone());
            entry.pending.push(line);
            entry.info.log_lines += 1.0;
        });
    }

    /// Resolves when the user cancels the job.
    pub fn cancellation(&self) -> &CancellationToken {
        &self.cancel
    }
}

/// Milliseconds since the Unix epoch, as the UI expects.
pub(super) fn now_ms() -> f64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|elapsed| elapsed.as_secs_f64() * 1000.0)
        .unwrap_or_default()
}
