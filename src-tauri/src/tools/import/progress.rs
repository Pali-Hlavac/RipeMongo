//! Reads `mongoimport` output: its progress bar for files (`[##...] shop.items\t14.8MB/200MB
//! (7.4%)`), the bytes read so far when RipeMongo feeds a CSV file itself, and the final
//! "N document(s) imported successfully. M document(s) failed to import.".

use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::Arc;

use crate::jobs::{JobProgress, ProgressUnit};
use crate::tools::run::OutputParser;
use crate::tools::text::{clean_namespace as clean, count, parse_size};

/// Progress of an import, measured in bytes of the file.
pub struct ImportProgress {
    size: f64,
    done: f64,
    /// Bytes RipeMongo has read from the file while feeding it (CSV imports).
    fed: Option<Arc<AtomicU64>>,
    imported: Option<f64>,
    failed: f64,
    message: Option<String>,
}

impl ImportProgress {
    /// `size` is the file size in bytes.
    pub fn new(size: f64, fed: Option<Arc<AtomicU64>>) -> Self {
        Self {
            size,
            done: 0.0,
            fed,
            imported: None,
            failed: 0.0,
            message: None,
        }
    }

    /// "Imported 1,204 documents into shop.items.", plus the documents that failed.
    pub fn summary(&self, namespace: &str) -> String {
        let imported = count(self.imported.unwrap_or(0.0), "document", "documents");
        let mut summary = format!("Imported {imported} into {namespace}.");
        if self.failed > 0.0 {
            let failed = count(self.failed, "document", "documents");
            summary.push_str(&format!(
                " {failed} could not be imported (for example duplicates); the log says why."
            ));
        }
        summary
    }

    fn progress(&self) -> JobProgress {
        JobProgress {
            done: self.done.min(self.size),
            total: Some(self.size),
            unit: ProgressUnit::Bytes,
            message: self.message.clone(),
        }
    }
}

impl OutputParser for ImportProgress {
    fn line(&mut self, line: &str) -> Option<JobProgress> {
        if let Some(fed) = &self.fed {
            // Data passed on so far; mongoimport reports only what it consumed.
            #[allow(clippy::cast_precision_loss)]
            {
                self.done = fed.load(Ordering::Relaxed) as f64;
            }
        }
        if let Some(rest) = line.strip_prefix("dropping: ") {
            self.message = Some(format!("Dropping {}", clean(rest)));
        } else if let Some((imported, rest)) =
            line.split_once(" document(s) imported successfully.")
        {
            // "5000 document(s) imported successfully. 2 document(s) failed to import."
            self.imported = Some(imported.trim().parse().ok()?);
            self.failed = rest.split_whitespace().next()?.parse().ok()?;
            self.done = self.size;
            self.message = None;
        } else if line.starts_with('[') {
            let (_, rest) = line.split_once(']')?;
            let mut parts = rest.split_whitespace();
            let namespace = parts.next()?;
            let (read, _) = parts.next()?.split_once('/')?;
            if self.fed.is_none() {
                self.done = parse_size(read)?;
            }
            self.message = Some(clean(namespace).to_owned());
        } else if self.fed.is_none() {
            return None;
        }
        Some(self.progress())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn follows_the_file_bar_and_counts_failures() {
        let mut progress = ImportProgress::new(200.0 * 1_048_576.0, None);
        assert!(progress
            .line("connected to: mongodb://localhost/")
            .is_none());
        let bar = progress
            .line("[#.......................] imp.big\t14.8MB/200MB (7.4%)")
            .unwrap();
        assert!((bar.done - 14.8 * 1_048_576.0).abs() < 1.0);
        assert_eq!(bar.message.as_deref(), Some("imp.big"));
        let end = progress
            .line("4998 document(s) imported successfully. 2 document(s) failed to import.")
            .unwrap();
        assert_eq!(end.done, end.total.unwrap());
        assert_eq!(
            progress.summary("imp.big"),
            "Imported 4,998 documents into imp.big. 2 documents could not be imported (for \
             example duplicates); the log says why."
        );
    }

    #[test]
    fn reports_the_bytes_fed_for_csv_files() {
        let fed = Arc::new(AtomicU64::new(0));
        let mut progress = ImportProgress::new(1_000.0, Some(Arc::clone(&fed)));
        let dropping = progress.line("dropping: `shop.people`").unwrap();
        assert_eq!(dropping.message.as_deref(), Some("Dropping shop.people"));
        fed.store(400, Ordering::Relaxed);
        let read = progress.line("shop.people\t11.3KB").unwrap();
        assert_eq!(read.done, 400.0);
        progress.line("1 document(s) imported successfully. 0 document(s) failed to import.");
        assert_eq!(
            progress.summary("shop.people"),
            "Imported 1 document into shop.people."
        );
    }
}
