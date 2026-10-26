//! Integration test: `mongoimport` jobs from JSON lines, a JSON array (merge mode) and a
//! semicolon-separated file with a byte order mark, typed and renamed columns, a column left
//! out, duplicates, drop and a value that does not fit its type. Needs Docker and
//! `pnpm sidecars`.

// Setup helpers should panic loudly, as in `common`.
#![allow(clippy::unwrap_used)]

mod common;

use std::path::Path;

use common::jobs::{import, registry, tools_available};
use common::*;
use mongodb::bson::{doc, Bson, Document};
use mongodb::Database;
use ripemongo_lib::connections::SecretUpdates;
use ripemongo_lib::jobs::{JobInfo, JobRegistry, JobStatus};
use ripemongo_lib::tools::import::{
    inspect_import_file, ColumnType, ImportColumn, ImportFormat, ImportMode, ImportRequest,
    ParseErrors,
};

/// Rows of the large CSV file, enough for several progress updates of the feed.
const ROWS: usize = 20_000;

fn request(collection: &str, path: &Path, format: ImportFormat) -> ImportRequest {
    ImportRequest {
        database: "shop".into(),
        collection: collection.into(),
        path: path.to_string_lossy().into_owned(),
        format,
        delimiter: ",".into(),
        header: true,
        columns: Vec::new(),
        ignore_blanks: false,
        parse_errors: ParseErrors::Stop,
        mode: ImportMode::Insert,
        match_fields: Vec::new(),
        drop: false,
        stop_on_error: false,
    }
}

/// Columns as the dialog builds them from the preview: suggested types, header names.
fn columns_of(path: &Path) -> Vec<ImportColumn> {
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
}

fn succeeded(jobs: &JobRegistry, job: JobInfo) -> String {
    assert_eq!(job.status, JobStatus::Succeeded, "{:?}", jobs.log(&job.id));
    job.summary.unwrap()
}

async fn find(database: &Database, collection: &str, filter: Document) -> Document {
    database
        .collection::<Document>(collection)
        .find_one(filter)
        .projection(doc! { "_id": 0 })
        .await
        .unwrap()
        .unwrap()
}

#[tokio::test]
async fn imports_json_and_typed_csv() {
    if !docker_available() || !tools_available() {
        return;
    }
    let (_container, port) = start_mongo().await;
    let (manager, dir) = manager();
    let id = manager
        .save(
            profile("Import", local_config(port)),
            &SecretUpdates::default(),
        )
        .unwrap()
        .id;
    manager.connect(&id).await.unwrap();
    let database = manager.client(&id).await.unwrap().database("shop");
    let jobs = registry();

    // JSON lines with Extended JSON, imported twice: the second time every document fails.
    let lines = dir.path().join("orders.json");
    std::fs::write(
        &lines,
        "{\"_id\":1,\"at\":{\"$date\":\"2024-03-05T10:00:00Z\"}}\n{\"_id\":2,\"n\":{\"$numberLong\":\"7\"}}\n",
    )
    .unwrap();
    let json = request("orders", &lines, ImportFormat::Json);
    let summary = succeeded(&jobs, import(&manager, &jobs, &id, json.clone()).await);
    assert_eq!(summary, "Imported 2 documents into shop.orders.");
    assert!(matches!(
        find(&database, "orders", doc! { "_id": 1 }).await.get("at"),
        Some(Bson::DateTime(_))
    ));
    let summary = succeeded(&jobs, import(&manager, &jobs, &id, json.clone()).await);
    assert!(
        summary.contains("2 documents could not be imported"),
        "{summary}"
    );
    let mut dropped = json;
    dropped.drop = true;
    succeeded(&jobs, import(&manager, &jobs, &id, dropped).await);

    // A JSON array merged into existing documents by a field.
    let array = dir.path().join("merge.json");
    std::fs::write(&array, "[{\"_id\":2,\"status\":\"paid\"},{\"_id\":3}]").unwrap();
    let mut merge = request("orders", &array, ImportFormat::JsonArray);
    merge.mode = ImportMode::Merge;
    succeeded(&jobs, import(&manager, &jobs, &id, merge).await);
    let merged = find(&database, "orders", doc! { "_id": 2 }).await;
    assert_eq!(merged, doc! { "n": 7_i64, "status": "paid" });

    // Semicolons, a byte order mark, suggested types, a renamed nested field, a left-out column.
    let people = dir.path().join("people.csv");
    std::fs::write(
        &people,
        "\u{feff}zip;born;active;city;secret\n01234;05.03.2024;true;Bratislava;x\n00042;31.12.2024;false;Košice;y\n",
    )
    .unwrap();
    let mut csv = request("people", &people, ImportFormat::Csv);
    csv.delimiter = ";".into();
    csv.columns = columns_of(&people);
    csv.columns[3].field = "address.city".into();
    csv.columns[4].include = false;
    let job = import(&manager, &jobs, &id, csv.clone()).await;
    let progress = job.progress.clone().unwrap();
    assert_eq!(progress.total, Some(progress.done));
    assert_eq!(
        succeeded(&jobs, job),
        "Imported 2 documents into shop.people."
    );
    let ann = find(&database, "people", doc! { "zip": "01234" }).await;
    assert!(matches!(ann.get("born"), Some(Bson::DateTime(_))), "{ann}");
    assert!(ann.get_bool("active").unwrap());
    assert_eq!(
        ann.get_document("address").unwrap(),
        &doc! { "city": "Bratislava" }
    );
    assert!(ann.get("secret").is_none());

    // A value that does not fit its type stops the import with mongoimport's reason.
    csv.columns[2].kind = ColumnType::Int32;
    csv.drop = true;
    let job = import(&manager, &jobs, &id, csv.clone()).await;
    assert_eq!(job.status, JobStatus::Failed);
    let message = job.error.unwrap().message;
    assert!(message.contains("could not parse token"), "{message}");
    // ...or skips the rows when asked to.
    csv.parse_errors = ParseErrors::SkipRow;
    let summary = succeeded(&jobs, import(&manager, &jobs, &id, csv).await);
    assert_eq!(summary, "Imported 0 documents into shop.people.");

    // A large comma-separated file without a header is streamed to the end.
    let big = dir.path().join("big.csv");
    let rows: String = (0..ROWS).map(|n| format!("{n},row {n}\n")).collect();
    std::fs::write(&big, rows).unwrap();
    let mut stream = request("big", &big, ImportFormat::Csv);
    stream.header = false;
    stream.columns = columns_of(&big);
    stream.columns[0].field = "n".into();
    stream.columns[1].field = "label".into();
    let summary = succeeded(&jobs, import(&manager, &jobs, &id, stream).await);
    assert_eq!(summary, "Imported 20,000 documents into shop.big.");
    let last = find(&database, "big", doc! { "n": 19_999 }).await;
    assert_eq!(last.get_str("label").unwrap(), "row 19999");
}
