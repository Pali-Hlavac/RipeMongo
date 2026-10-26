//! Opt-in load test (not in CI): imports a generated JSON lines file and a CSV file of
//! several GB with one and with several insert workers, then cancels a CSV import partway.
//! Checks that progress moves steadily, that RipeMongo's and mongoimport's memory stays flat
//! and that cancelling stops mongoimport. Prints a table for `docs/development/testing.md`.
//!
//! `RIPEMONGO_LARGE_IMPORT_GB=3 cargo test --test import_large -- --ignored --nocapture`
//! (`RIPEMONGO_LARGE_IMPORT_WORKERS` sets the parallel run; default 8). A debug build is
//! enough: mongoimport, not RipeMongo's CSV feed, sets the pace. Needs Docker,
//! `pnpm sidecars` and free disk space for twice the size plus the imported data.

#![allow(clippy::unwrap_used, clippy::expect_used)]

mod common;

use std::path::Path;
use std::time::{Duration, Instant};

use common::jobs::{registry, tools_available};
use common::large::{generate, MemorySampler};
use common::load::{watch, MIB};
use common::*;
use mongodb::bson::Document;
use mongodb::Database;
use ripemongo_lib::connections::SecretUpdates;
use ripemongo_lib::jobs::JobStatus;
use ripemongo_lib::tools::import::{
    inspect_import_file, ImportColumn, ImportFormat, ImportMode, ImportRequest, ParseErrors,
};

const DEFAULT_SIZE_GB: f64 = 2.0;
const DEFAULT_WORKERS: u32 = 8;
const BYTES_PER_GB: f64 = 1_073_741_824.0;
/// The cancelled import is stopped once this share of the file is read.
const CANCEL_AT: f64 = 0.3;
const CANCEL_LIMIT: Duration = Duration::from_secs(10);
/// Time for the operating system to remove the stopped process.
const EXIT_GRACE: Duration = Duration::from_secs(1);

fn env_or<T: std::str::FromStr>(name: &str, default: T) -> T {
    std::env::var(name)
        .ok()
        .and_then(|value| value.parse().ok())
        .unwrap_or(default)
}

/// Replaces `load.orders` with the file, typed columns as suggested for CSV.
fn request(path: &Path, format: ImportFormat, workers: u32) -> ImportRequest {
    let columns = if format == ImportFormat::Csv {
        let preview = inspect_import_file(&path.to_string_lossy(), None).unwrap();
        preview
            .columns
            .into_iter()
            .map(|column| ImportColumn {
                include: true,
                field: column.first,
                kind: column.suggestion.kind,
                date_format: column.suggestion.date_format,
            })
            .collect()
    } else {
        Vec::new()
    };
    ImportRequest {
        database: "load".into(),
        collection: "orders".into(),
        path: path.to_string_lossy().into_owned(),
        format,
        delimiter: ",".into(),
        header: true,
        columns,
        ignore_blanks: false,
        parse_errors: ParseErrors::Stop,
        mode: ImportMode::Insert,
        match_fields: Vec::new(),
        drop: true,
        stop_on_error: false,
        insertion_workers: Some(workers),
        bypass_validation: false,
    }
}

async fn count(database: &Database) -> u64 {
    database
        .collection::<Document>("orders")
        .count_documents(Document::new())
        .await
        .unwrap()
}

#[tokio::test(flavor = "multi_thread")]
#[ignore = "load test with files of several GB; see docs/development/testing.md"]
async fn imports_large_files_with_flat_memory() {
    if !docker_available() || !tools_available() {
        return;
    }
    let size_gb: f64 = env_or("RIPEMONGO_LARGE_IMPORT_GB", DEFAULT_SIZE_GB);
    let workers: u32 = env_or("RIPEMONGO_LARGE_IMPORT_WORKERS", DEFAULT_WORKERS);
    let dir = tempfile::tempdir().unwrap();
    let generating = Instant::now();
    // Whole bytes are enough for a target size.
    #[allow(clippy::cast_possible_truncation, clippy::cast_sign_loss)]
    let files = generate(dir.path(), (size_gb * BYTES_PER_GB) as u64).unwrap();
    println!(
        "Generated {} documents ({} MiB JSON, {} MiB CSV) in {:.0} s",
        files.documents,
        files.json_bytes / MIB,
        files.csv_bytes / MIB,
        generating.elapsed().as_secs_f64()
    );

    let (_container, port) = start_mongo().await;
    let (manager, _config_dir) = manager();
    let profile = profile("Load", local_config(port));
    let id = manager.save(profile, &SecretUpdates::default()).unwrap().id;
    manager.connect(&id).await.unwrap();
    let database = manager.client(&id).await.unwrap().database("load");
    let jobs = registry();

    let mut rows = Vec::new();
    for (format, path, bytes) in [
        (ImportFormat::Json, &files.json, files.json_bytes),
        (ImportFormat::Csv, &files.csv, files.csv_bytes),
    ] {
        for run_workers in [1, workers] {
            let label = format!("{format:?} with {run_workers} worker(s)");
            let request = request(path, format, run_workers);
            let watched = watch(&manager, &jobs, &id, request, None).await;
            let error = &watched.job.error;
            assert_eq!(
                watched.job.status,
                JobStatus::Succeeded,
                "{label}: {error:?}"
            );
            assert_eq!(count(&database).await, files.documents, "{label}");
            watched.check(&label);
            let seconds = watched.elapsed.as_secs_f64();
            #[allow(clippy::cast_precision_loss)]
            let (mib_per_second, documents_per_second) = (
                bytes as f64 / MIB as f64 / seconds,
                files.documents as f64 / seconds,
            );
            let row = format!(
                "| {format:?} | {run_workers} | {seconds:.0} s | {mib_per_second:.0} MiB/s | \
                 {documents_per_second:.0} | {:.1} s | {} MiB | {} MiB |",
                watched.longest_gap.as_secs_f64(),
                watched.own_growth() / MIB,
                watched.peak.tool / MIB
            );
            println!("{row}");
            rows.push(row);
        }
    }

    // Cancelling stops mongoimport and the feed promptly; the job ends as cancelled.
    let request = request(&files.csv, ImportFormat::Csv, workers);
    let cancelled = watch(&manager, &jobs, &id, request, Some(CANCEL_AT)).await;
    assert_eq!(cancelled.job.status, JobStatus::Cancelled);
    let stopping = cancelled.stopping.expect("the import was cancelled");
    assert!(stopping < CANCEL_LIMIT, "stopping took {stopping:?}");
    tokio::time::sleep(EXIT_GRACE).await;
    let left = MemorySampler::new().sample().tool;
    assert_eq!(left, 0, "mongoimport still runs");
    assert!(count(&database).await < files.documents);

    println!(
        "\n| Format | Insert workers | Time | Throughput | Documents/s | Longest progress \
         pause | RipeMongo growth | mongoimport peak |"
    );
    println!("| --- | --- | --- | --- | --- | --- | --- | --- |");
    for row in rows {
        println!("{row}");
    }
    println!(
        "Cancelled at {:.0} % of the file; stopped after {:.1} s (limit {} s).",
        CANCEL_AT * 100.0,
        stopping.as_secs_f64(),
        CANCEL_LIMIT.as_secs()
    );
}
