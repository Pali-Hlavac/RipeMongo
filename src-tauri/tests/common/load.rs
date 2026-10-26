//! Watches an import of the large-file load test: memory, progress and cancelling over time.

use std::time::{Duration, Instant};

use ripemongo_lib::connections::ConnectionManager;
use ripemongo_lib::jobs::{JobInfo, JobRegistry, JobStatus};
use ripemongo_lib::tools::import::{start_import, ImportRequest};

use super::large::{MemorySample, MemorySampler};

pub const MIB: u64 = 1_048_576;
const SAMPLE_INTERVAL: Duration = Duration::from_millis(250);
/// Longest one import of the generated file may take.
const IMPORT_LIMIT: Duration = Duration::from_secs(3_600);
/// Flat memory: what RipeMongo may grow by, and what mongoimport may use, whatever the size.
const MAX_OWN_GROWTH: u64 = 256 * MIB;
const MAX_TOOL_MEMORY: u64 = 1_024 * MIB;
/// Steady progress: the longest the progress bar may stand still (mongoimport reports about
/// every 3 seconds).
const MAX_PROGRESS_GAP: Duration = Duration::from_secs(5);

/// What one import did over time.
pub struct Watched {
    pub job: JobInfo,
    pub elapsed: Duration,
    pub baseline: MemorySample,
    pub peak: MemorySample,
    /// Progress values in the order they were seen.
    pub progress: Vec<f64>,
    /// Longest time between two changes of the progress (from the first one on).
    pub longest_gap: Duration,
    /// From asking to cancel until the job ended.
    pub stopping: Option<Duration>,
}

impl Watched {
    /// What RipeMongo's own memory grew by during the import.
    pub fn own_growth(&self) -> u64 {
        self.peak.own.saturating_sub(self.baseline.own)
    }

    /// Asserts flat memory and steady progress.
    pub fn check(&self, label: &str) {
        let growth = self.own_growth();
        assert!(
            growth < MAX_OWN_GROWTH,
            "{label}: RipeMongo grew by {} MiB",
            growth / MIB
        );
        assert!(
            self.peak.tool < MAX_TOOL_MEMORY,
            "{label}: mongoimport used {} MiB",
            self.peak.tool / MIB
        );
        assert!(self.peak.tool > 0, "{label}: mongoimport was not seen");
        assert!(
            self.progress.windows(2).all(|pair| pair[0] <= pair[1]),
            "{label}: progress went back"
        );
        assert!(
            self.longest_gap < MAX_PROGRESS_GAP,
            "{label}: progress stood still for {:?}",
            self.longest_gap
        );
    }
}

/// Starts an import and samples it until it ends; cancels it once `cancel_at` (a share) of
/// the file is read.
pub async fn watch(
    manager: &ConnectionManager,
    jobs: &JobRegistry,
    id: &str,
    request: ImportRequest,
    cancel_at: Option<f64>,
) -> Watched {
    let mut sampler = MemorySampler::new();
    let baseline = sampler.sample();
    let mut peak = MemorySample::default();
    let mut progress: Vec<f64> = Vec::new();
    let mut cancelled: Option<Instant> = None;
    let connection = manager.tool_connection(id).await.expect("connection");
    let started = Instant::now();
    let mut last_change: Option<Instant> = None;
    let mut longest_gap = Duration::ZERO;
    let job = start_import(jobs, id.to_owned(), connection, request).expect("import started");
    loop {
        assert!(started.elapsed() < IMPORT_LIMIT, "the import took too long");
        tokio::time::sleep(SAMPLE_INTERVAL).await;
        let sample = sampler.sample();
        peak.own = peak.own.max(sample.own);
        peak.tool = peak.tool.max(sample.tool);
        let info = jobs
            .list()
            .into_iter()
            .find(|listed| listed.id == job.id)
            .expect("job is listed");
        if let Some(current) = &info.progress {
            if progress.last() != Some(&current.done) {
                if let Some(at) = last_change {
                    longest_gap = longest_gap.max(at.elapsed());
                }
                last_change = Some(Instant::now());
                progress.push(current.done);
            }
            let total = current.total.unwrap_or(f64::MAX);
            if cancelled.is_none() && cancel_at.is_some_and(|share| current.done >= total * share) {
                jobs.cancel(&job.id).expect("cancel");
                cancelled = Some(Instant::now());
            }
        }
        if info.status != JobStatus::Running {
            return Watched {
                job: info,
                elapsed: started.elapsed(),
                baseline,
                peak,
                progress,
                longest_gap,
                stopping: cancelled.map(|at| at.elapsed()),
            };
        }
    }
}
