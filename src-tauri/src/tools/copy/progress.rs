//! Progress of a copy: documents read by `mongodump` (the pipe keeps it only a little ahead
//! of `mongorestore`), then the indexes `mongorestore` builds, and its counts for the summary.

use crate::jobs::JobProgress;
use crate::tools::dump::DumpProgress;
use crate::tools::pipe::PipeOutputParser;
use crate::tools::restore::RestoreProgress;
use crate::tools::run::OutputParser;
use crate::tools::text::count;
use crate::tools::Tool;

/// Reads the output of both tools of a copy.
pub struct CopyProgress {
    dump: DumpProgress,
    restore: RestoreProgress,
    last: Option<JobProgress>,
}

impl CopyProgress {
    /// `total` is the estimated number of documents to copy, if known.
    pub fn new(total: Option<f64>) -> Self {
        Self {
            dump: DumpProgress::new(total),
            restore: RestoreProgress::default(),
            last: None,
        }
    }

    /// "Copied 1,204 documents (2 collections) to copy on Production.", plus the documents
    /// that could not be written.
    pub fn summary(&self, target: &str) -> String {
        let totals = self.restore.totals();
        // Collection counts are small; the cast is exact.
        #[allow(clippy::cast_precision_loss)]
        let collections = count(totals.collections as f64, "collection", "collections");
        let documents = count(totals.documents, "document", "documents");
        let mut summary = format!("Copied {documents} ({collections}) to {target}.");
        if totals.failures > 0.0 {
            let failed = count(totals.failures, "document", "documents");
            summary.push_str(&format!(
                " {failed} could not be copied, for example because a document with the same \
                 _id already exists in the target; the log lists them."
            ));
        }
        summary
    }
}

impl PipeOutputParser for CopyProgress {
    fn line(&mut self, tool: Tool, line: &str) -> Option<JobProgress> {
        if tool == Tool::Mongodump {
            let progress = self.dump.line(line)?;
            self.last = Some(progress.clone());
            return Some(progress);
        }
        self.restore.line(line);
        // "restoring indexes for collection `copy.orders` from metadata"
        let rest = line.strip_prefix("restoring indexes for collection `")?;
        let (namespace, _) = rest.split_once('`')?;
        let mut progress = self.last.clone()?;
        progress.message = Some(format!("Creating the indexes of {namespace}"));
        Some(progress)
    }
}
