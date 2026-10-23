//! Reads `mongorestore` output: the collection being restored with its progress, finished
//! collections with document and failure counts, the final totals, and for dry runs the
//! collections that would be restored.

use crate::jobs::{JobProgress, ProgressUnit};
use crate::tools::run::OutputParser;
use crate::tools::text::{clean_namespace as clean, count};

/// Collections named in a dry-run summary before "and N more".
const LISTED_IN_SUMMARY: usize = 5;

/// Progress of a restore, measured in documents (mongorestore reports no total up front).
#[derive(Default)]
pub struct RestoreProgress {
    documents: f64,
    failures: f64,
    collections: usize,
    current: Option<String>,
    /// Dry runs: `(from, to)` namespaces that would be restored.
    planned: Vec<(String, String)>,
    oplog_entries: Option<f64>,
}

impl RestoreProgress {
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
        if let Some(entries) = self.oplog_entries {
            let entries = count(entries, "oplog entry", "oplog entries");
            summary.push_str(&format!(" Replayed {entries}."));
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
            self.current = Some(clean(namespace).to_owned());
        } else if let Some(rest) = line.strip_prefix("restoring `") {
            // "restoring `shop.items` from …"; not "restoring indexes …".
            let (namespace, _) = rest.split_once("` from ")?;
            self.current = Some(namespace.to_owned());
        } else if let Some(rest) = line.strip_prefix("found collection `") {
            // Dry run: "found collection `shop.items` bson to restore to `copy.items`"
            let (from, to) = rest.split_once("` bson to restore to ")?;
            self.planned.push((from.to_owned(), clean(to).to_owned()));
            return None;
        } else if let Some(rest) = line.trim_start().strip_prefix("applied ") {
            // "applied 5 oplog entries"
            self.oplog_entries = Some(rest.split_whitespace().next()?.parse().ok()?);
        } else if line.starts_with('[') {
            // Folder dumps: "[####....]  shop.items  12.5MB/68.4MB  (18.3%)"
            let (_, rest) = line.split_once(']')?;
            let mut parts = rest.split_whitespace();
            let namespace = clean(parts.next()?);
            let percent = parts.last()?.trim_matches(['(', ')', '%']);
            let percent: f64 = percent.parse().ok()?;
            self.current = Some(format!("{namespace} ({percent:.0}%)"));
        } else {
            // Archives: "shop.items  12.3MB"
            let mut parts = line.split_whitespace();
            let (namespace, size) = (parts.next()?, parts.next()?);
            let is_size = size.ends_with('B') && size.starts_with(|c: char| c.is_ascii_digit());
            if parts.next().is_some() || !is_size || !namespace.contains('.') {
                return None;
            }
            self.current = Some(format!("{} ({size})", clean(namespace)));
        }
        Some(JobProgress {
            done: self.documents,
            total: None,
            unit: ProgressUnit::Documents,
            message: self.current.clone(),
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn counts_finished_collections_and_failures() {
        let mut progress = RestoreProgress::default();
        let started = progress
            .line("restoring `copy.items` from `folder\\shop\\items.bson`")
            .unwrap();
        assert_eq!(started.message.as_deref(), Some("copy.items"));
        assert!(progress
            .line("restoring indexes for collection `copy.users` from metadata")
            .is_none());
        let bar = progress
            .line("[####....................]  copy.items  12.5MB/68.4MB  (18.3%)")
            .unwrap();
        assert_eq!(bar.message.as_deref(), Some("copy.items (18%)"));
        let archive = progress.line("shop.items  12.3MB").unwrap();
        assert_eq!(archive.message.as_deref(), Some("shop.items (12.3MB)"));
        progress.line("finished restoring `copy.users` (0 documents, 2 failures)");
        let done = progress
            .line("finished restoring `copy.items` (300000 documents, 0 failures)")
            .unwrap();
        assert_eq!((done.done, done.total), (300_000.0, None));
        assert!(progress
            .line("preparing collections to restore from")
            .is_none());
        assert!(progress
            .line("no indexes to restore for collection `x.y`")
            .is_none());

        let summary = progress.summary(false);
        assert!(
            summary.starts_with(
                "Restored 300,000 documents into 2 collections. 2 documents could not be restored"
            ),
            "{summary}"
        );
    }

    #[test]
    fn reports_the_oplog_and_dry_runs() {
        let mut progress = RestoreProgress::default();
        progress.line("finished restoring `shop.users` (1 document, 0 failures)");
        progress.line("\tapplied 3 oplog entries");
        assert_eq!(
            progress.summary(false),
            "Restored 1 document into 1 collection. Replayed 3 oplog entries."
        );

        let mut dry = RestoreProgress::default();
        assert!(dry.summary(true).contains("nothing in the dump matches"));
        dry.line("found collection `shop.items` bson to restore to `shop.items`");
        dry.line("found collection metadata from `shop.items` to restore to `shop.items`");
        dry.line("found collection `shop.users` bson to restore to `copy.users`");
        assert_eq!(
            dry.summary(true),
            "Dry run: would restore 2 collections: shop.items, shop.users as copy.users. Nothing was written."
        );
    }
}
