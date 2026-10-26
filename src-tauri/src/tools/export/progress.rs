//! Reads `mongoexport` output: its progress bar (`[###...]  shop.items  600/1000  (60.0%)`)
//! and the final "exported N records".

use crate::jobs::{JobProgress, ProgressUnit};
use crate::tools::run::OutputParser;
use crate::tools::text::count;

/// Progress of an export, measured in documents.
#[derive(Default)]
pub struct ExportProgress {
    done: f64,
    total: Option<f64>,
    exported: Option<f64>,
}

impl ExportProgress {
    /// "Exported 1,204 documents to <path>."
    pub fn summary(&self, path: &str) -> String {
        let documents = count(self.exported.unwrap_or(self.done), "document", "documents");
        format!("Exported {documents} to {path}.")
    }
}

impl OutputParser for ExportProgress {
    fn line(&mut self, line: &str) -> Option<JobProgress> {
        if let Some(rest) = line.strip_prefix("exported ") {
            // "exported 5000 records"
            let exported = rest.split_whitespace().next()?.parse().ok()?;
            self.exported = Some(exported);
            self.done = exported;
            self.total = Some(exported);
        } else if line.starts_with('[') {
            let (_, rest) = line.split_once(']')?;
            let (done, total) = rest.split_whitespace().nth(1)?.split_once('/')?;
            self.done = done.parse().ok()?;
            self.total = Some(total.parse().ok()?);
        } else {
            return None;
        }
        Some(JobProgress {
            done: self.done,
            total: self.total.map(|total| total.max(self.done)),
            unit: ProgressUnit::Documents,
            message: None,
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn follows_the_bar_and_the_final_count() {
        let mut progress = ExportProgress::default();
        assert!(progress
            .line("connected to: mongodb://localhost/")
            .is_none());
        let bar = progress
            .line("[#####...................]  shop.big  168000/800000  (21.0%)")
            .unwrap();
        assert_eq!((bar.done, bar.total), (168_000.0, Some(800_000.0)));
        let end = progress.line("exported 800000 records").unwrap();
        assert_eq!((end.done, end.total), (800_000.0, Some(800_000.0)));
        assert_eq!(
            progress.summary("C:/out.json"),
            "Exported 800,000 documents to C:/out.json."
        );
    }

    #[test]
    fn small_exports_only_report_the_end() {
        let mut progress = ExportProgress::default();
        progress.line("exported 1 record");
        assert_eq!(progress.summary("x"), "Exported 1 document to x.");
    }
}
