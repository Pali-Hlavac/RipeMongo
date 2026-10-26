//! Reads `mongorestore` output: the collection being restored with its progress, finished
//! collections with document and failure counts, the final totals, and for dry runs the
//! collections that would be restored.

use std::collections::HashMap;

use crate::jobs::{JobProgress, ProgressUnit};
use crate::tools::run::OutputParser;
use crate::tools::text::{clean_namespace as clean, count, parse_size};

/// Collections named in a dry-run summary before "and N more".
const LISTED_IN_SUMMARY: usize = 5;
/// Dry runs list these too, but mongorestore never restores them as collections.
const NOT_RESTORED: [&str; 1] = ["admin.system.version"];

/// Progress of a restore. Folder dumps know each data file's size, so progress is measured in
/// bytes read; archives give no sizes up front, so it falls back to documents restored.
#[derive(Default)]
pub struct RestoreProgress {
    documents: f64,
    failures: f64,
    collections: usize,
    current: Option<String>,
    /// Dry runs: `(from, to)` namespaces that would be restored.
    planned: Vec<(String, String)>,
    oplog_entries: Option<f64>,
    /// Data file size by target namespace (folder dumps only).
    sizes: HashMap<String, f64>,
    /// Bytes read so far by target namespace.
    read: HashMap<String, f64>,
}

impl RestoreProgress {
    /// `sizes`: data file size by target namespace; empty when unknown.
    pub fn new(sizes: HashMap<String, f64>) -> Self {
        Self {
            sizes,
            ..Self::default()
        }
    }

    /// What happened, for the job summary.
    pub fn summary(&self, dry_run: bool) -> String {
        if dry_run {
            return self.dry_run_summary();
        }
        // Collection counts are small; the cast is exact.
        #[allow(clippy::cast_precision_loss)]
        let collections = count(self.collections as f64, "collection", "collections");
        let documents = count(self.documents, "document", "documents");
        let mut summary = format!("Restored {documents} into {collections}.");
        match self.oplog_entries {
            Some(0.0) => summary.push_str(" The oplog had no changes to replay."),
            Some(entries) => {
                let entries = count(entries, "oplog entry", "oplog entries");
                summary.push_str(&format!(" Replayed {entries}."));
            }
            None => {}
        }
        if self.failures > 0.0 {
            let failed = count(self.failures, "document", "documents");
            summary.push_str(&format!(
                " {failed} could not be restored, for example because a document with the same \
                 _id already exists; the log lists them."
            ));
        }
        summary
    }

    fn dry_run_summary(&self) -> String {
        if self.planned.is_empty() {
            return "Dry run: nothing in the dump matches. Nothing was written.".into();
        }
        let listed: Vec<String> = self
            .planned
            .iter()
            .take(LISTED_IN_SUMMARY)
            .map(|(from, to)| {
                if from == to {
                    from.clone()
                } else {
                    format!("{from} as {to}")
                }
            })
            .collect();
        let more = self.planned.len().saturating_sub(LISTED_IN_SUMMARY);
        let more = if more > 0 {
            format!(" and {more} more")
        } else {
            String::new()
        };
        // Collection counts are small; the cast is exact.
        #[allow(clippy::cast_precision_loss)]
        let collections = count(self.planned.len() as f64, "collection", "collections");
        format!(
            "Dry run: would restore {collections}: {}{more}. Nothing was written.",
            listed.join(", ")
        )
    }

    fn progress(&self) -> JobProgress {
        let total: f64 = self.sizes.values().sum();
        if total > 0.0 {
            let done: f64 = self.read.values().sum();
            return JobProgress {
                done: done.min(total),
                total: Some(total),
                unit: ProgressUnit::Bytes,
                message: self.current.clone(),
            };
        }
        JobProgress {
            done: self.documents,
            total: None,
            unit: ProgressUnit::Documents,
            message: self.current.clone(),
        }
    }

    /// Records bytes read for a namespace, never more than its file size.
    fn read_bytes(&mut self, namespace: &str, bytes: f64) {
        let bytes = self
            .sizes
            .get(namespace)
            .map_or(bytes, |size| bytes.min(*size));
        self.read.insert(namespace.to_owned(), bytes);
    }
}

impl OutputParser for RestoreProgress {
    fn line(&mut self, line: &str) -> Option<JobProgress> {
        if let Some(rest) = line.strip_prefix("finished restoring ") {
            // "`shop.items` (300 documents, 2 failures)"
            let (namespace, counts) = rest.rsplit_once(" (")?;
            let mut numbers = counts
                .split(|c: char| !c.is_ascii_digit())
                .filter(|part| !part.is_empty());
            self.documents += numbers.next()?.parse::<f64>().ok()?;
            self.failures += numbers.next().and_then(|n| n.parse().ok()).unwrap_or(0.0);
            self.collections += 1;
            let namespace = clean(namespace).to_owned();
            if let Some(size) = self.sizes.get(&namespace).copied() {
                self.read_bytes(&namespace, size);
            }
            self.current = Some(namespace);
        } else if let Some(rest) = line.strip_prefix("restoring `") {
            // "restoring `shop.items` from …"; not "restoring indexes …".
            let (namespace, _) = rest.split_once("` from ")?;
            self.current = Some(namespace.to_owned());
        } else if let Some(rest) = line.strip_prefix("found collection `") {
            // Dry run: "found collection `shop.items` bson to restore to `copy.items`"
            let (from, to) = rest.split_once("` bson to restore to ")?;
            if !from.starts_with('.') && !NOT_RESTORED.contains(&from) {
                self.planned.push((from.to_owned(), clean(to).to_owned()));
            }
            return None;
        } else if let Some(rest) = line.trim_start().strip_prefix("applied ") {
            // "applied 5 oplog entries"
            self.oplog_entries = Some(rest.split_whitespace().next()?.parse().ok()?);
        } else if line.starts_with('[') {
            // Folder dumps: "[####....]  shop.items  12.5MB/68.4MB  (18.3%)"
            let (_, rest) = line.split_once(']')?;
            let mut parts = rest.split_whitespace();
            let namespace = clean(parts.next()?).to_owned();
            let (read, _) = parts.next()?.split_once('/')?;
            let percent: f64 = parts.next()?.trim_matches(['(', ')', '%']).parse().ok()?;
            if let Some(bytes) = parse_size(read) {
                self.read_bytes(&namespace, bytes);
            }
            self.current = Some(format!("{namespace} ({percent:.0}%)"));
        } else {
            // Archives: "shop.items  12.3MB"
            let mut parts = line.split_whitespace();
            let (namespace, size) = (parts.next()?, parts.next()?);
            if parts.next().is_some() || parse_size(size).is_none() || !namespace.contains('.') {
                return None;
            }
            self.current = Some(format!("{} ({size})", clean(namespace)));
        }
        Some(self.progress())
    }
}
