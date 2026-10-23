//! Reads `mongodump` output: which collection it is writing, per-collection progress bars and
//! "done dumping" lines, summed into one document count, plus the oplog of `--oplog` dumps.

use std::collections::HashMap;

use crate::jobs::{JobProgress, ProgressUnit};
use crate::tools::run::OutputParser;
use crate::tools::text::{clean_namespace as clean, count};

/// Label shown while `--oplog` dumps write the captured oplog.
const OPLOG_LABEL: &str = "oplog";

/// Progress of a dump, measured in documents.
pub struct DumpProgress {
    total: Option<f64>,
    done: HashMap<String, f64>,
    current: Option<String>,
    collections: usize,
    oplog_entries: Option<f64>,
}

impl DumpProgress {
    /// `total` is the estimated number of documents to dump, if known.
    pub fn new(total: Option<f64>) -> Self {
        Self {
            total,
            done: HashMap::new(),
            current: None,
            collections: 0,
            oplog_entries: None,
        }
    }

    fn documents(&self) -> f64 {
        self.done.values().sum()
    }

    /// "Dumped 3 collections (1,204 documents) to <path>.", with "and 5 oplog entries" for
    /// `--oplog` dumps.
    pub fn summary(&self, path: &str) -> String {
        // Collection counts are small; the cast is exact.
        #[allow(clippy::cast_precision_loss)]
        let collections = count(self.collections as f64, "collection", "collections");
        let documents = count(self.documents(), "document", "documents");
        let oplog = self.oplog_entries.map_or_else(String::new, |entries| {
            format!(" and {}", count(entries, "oplog entry", "oplog entries"))
        });
        format!("Dumped {collections} ({documents}){oplog} to {path}.")
    }
}

impl OutputParser for DumpProgress {
    fn line(&mut self, line: &str) -> Option<JobProgress> {
        if line.starts_with("writing captured oplog") {
            self.current = Some(OPLOG_LABEL.to_owned());
        } else if let Some(rest) = line.trim_start().strip_prefix("dumped ") {
            // "dumped 5 oplog entries"; collections are never reported this way.
            let count = rest.split_whitespace().next()?.parse().ok()?;
            self.oplog_entries = Some(count);
        } else if let Some(rest) = line.strip_prefix("writing ") {
            let namespace = rest.split(" to ").next().unwrap_or(rest);
            self.current = Some(clean(namespace).to_owned());
        } else if let Some(rest) = line.strip_prefix("done dumping ") {
            // "`shop.items` (3 documents)"
            let (namespace, count) = rest.rsplit_once(" (")?;
            let count = count.split_whitespace().next()?.parse().ok()?;
            self.done.insert(clean(namespace).to_owned(), count);
            self.collections += 1;
        } else if line.starts_with('[') {
            // "[#####...]  shop.items  600/1000  (60.0%)"
            let (_, rest) = line.split_once(']')?;
            let mut parts = rest.split_whitespace();
            let namespace = parts.next()?;
            let (done, _) = parts.next()?.split_once('/')?;
            let namespace = clean(namespace).to_owned();
            self.done.insert(namespace.clone(), done.parse().ok()?);
            // Collections are dumped in parallel; the bar names the one still in progress.
            self.current = Some(namespace);
        } else {
            return None;
        }
        let done = self.documents();
        Some(JobProgress {
            done,
            total: self.total.map(|total| total.max(done)),
            unit: ProgressUnit::Documents,
            message: self.current.clone(),
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn sums_progress_bars_and_finished_collections() {
        let mut progress = DumpProgress::new(Some(1_500.0));
        let writing = progress
            .line("writing shop.items to dump/shop/items.bson")
            .unwrap();
        assert_eq!(writing.message.as_deref(), Some("shop.items"));
        assert_eq!(writing.done, 0.0);

        let bar = progress
            .line("[#############...........]  shop.items  600/1000  (60.0%)")
            .unwrap();
        assert_eq!((bar.done, bar.total), (600.0, Some(1_500.0)));

        // Messages quote namespaces; the bar did not. Both mean the same collection.
        progress.line("done dumping `shop.items` (1000 documents)");
        progress.line("writing `shop.users` to `dump/shop/users.bson`");
        let last = progress
            .line("done dumping shop.users (204 documents)")
            .unwrap();
        assert_eq!(last.done, 1_204.0);
        assert_eq!(last.message.as_deref(), Some("shop.users"));
        assert!(progress
            .line("dumping up to 4 collections in parallel")
            .is_none());
        assert_eq!(
            progress.summary("C:/dumps"),
            "Dumped 2 collections (1,204 documents) to C:/dumps."
        );
        let bar = progress
            .line("[####....]  big.events  10/100  (10.0%)")
            .unwrap();
        assert_eq!(bar.message.as_deref(), Some("big.events"));
    }

    #[test]
    fn total_never_falls_below_what_was_dumped() {
        let mut progress = DumpProgress::new(Some(10.0));
        let done = progress
            .line("done dumping shop.items (12 documents)")
            .unwrap();
        assert_eq!(done.total, Some(12.0));
        assert_eq!(
            progress.summary("x"),
            "Dumped 1 collection (12 documents) to x."
        );
    }

    #[test]
    fn reports_the_captured_oplog() {
        let mut progress = DumpProgress::new(None);
        progress.line("done dumping `shop.items` (2 documents)");
        let writing = progress.line("writing captured oplog to ``").unwrap();
        assert_eq!(writing.message.as_deref(), Some("oplog"));
        progress.line("	dumped 3 oplog entries");
        assert_eq!(
            progress.summary("x"),
            "Dumped 1 collection (2 documents) and 3 oplog entries to x."
        );
    }
}
