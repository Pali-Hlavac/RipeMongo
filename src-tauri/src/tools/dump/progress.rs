//! Reads `mongodump` output: which collection it is writing, per-collection progress bars and
//! "done dumping" lines, summed into one document count.

use std::collections::HashMap;

use crate::jobs::{JobProgress, ProgressUnit};
use crate::tools::run::OutputParser;

/// Progress of a dump, measured in documents.
pub struct DumpProgress {
    total: Option<f64>,
    done: HashMap<String, f64>,
    current: Option<String>,
    collections: usize,
}

impl DumpProgress {
    /// `total` is the estimated number of documents to dump, if known.
    pub fn new(total: Option<f64>) -> Self {
        Self {
            total,
            done: HashMap::new(),
            current: None,
            collections: 0,
        }
    }

    fn documents(&self) -> f64 {
        self.done.values().sum()
    }

    /// "Dumped 3 collections (1,204 documents) to <path>."
    pub fn summary(&self, path: &str) -> String {
        let collections = match self.collections {
            1 => "1 collection".to_owned(),
            count => format!("{count} collections"),
        };
        let count = self.documents();
        let documents = if count == 1.0 {
            "1 document".to_owned()
        } else {
            format!("{} documents", thousands(count))
        };
        format!("Dumped {collections} ({documents}) to {path}.")
    }
}

impl OutputParser for DumpProgress {
    fn line(&mut self, line: &str) -> Option<JobProgress> {
        if let Some(rest) = line.strip_prefix("writing ") {
            let namespace = rest.split(" to ").next().unwrap_or(rest);
            self.current = Some(namespace.to_owned());
        } else if let Some(rest) = line.strip_prefix("done dumping ") {
            // "shop.items (3 documents)"
            let (namespace, count) = rest.rsplit_once(" (")?;
            let count = count.split_whitespace().next()?.parse().ok()?;
            self.done.insert(namespace.to_owned(), count);
            self.collections += 1;
        } else if line.starts_with('[') {
            // "[#####...]  shop.items  600/1000  (60.0%)"
            let (_, rest) = line.split_once(']')?;
            let mut parts = rest.split_whitespace();
            let namespace = parts.next()?;
            let (done, _) = parts.next()?.split_once('/')?;
            self.done.insert(namespace.to_owned(), done.parse().ok()?);
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

/// 1204 → "1,204".
fn thousands(value: f64) -> String {
    let digits = format!("{value:.0}");
    let mut grouped = String::with_capacity(digits.len() + digits.len() / 3);
    for (index, digit) in digits.chars().enumerate() {
        if index > 0 && (digits.len() - index) % 3 == 0 {
            grouped.push(',');
        }
        grouped.push(digit);
    }
    grouped
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

        progress.line("done dumping shop.items (1000 documents)");
        progress.line("writing shop.users to dump/shop/users.bson");
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
    fn groups_thousands() {
        assert_eq!(thousands(0.0), "0");
        assert_eq!(thousands(999.0), "999");
        assert_eq!(thousands(1_234_567.0), "1,234,567");
    }
}
