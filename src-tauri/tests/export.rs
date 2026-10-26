//! Integration test: field sampling and `mongoexport` jobs to JSON (lines and array) and CSV,
//! with a query, sort, skip and limit, from a collection and a view. Needs Docker and
//! `pnpm sidecars`.

// Setup helpers should panic loudly, as in `common`.
#![allow(clippy::unwrap_used)]

mod common;

use common::jobs::{export, registry, tools_available};
use common::*;
use mongodb::bson::{doc, Document};
use ripemongo_lib::connections::SecretUpdates;
use ripemongo_lib::documents::sample_fields;
use ripemongo_lib::jobs::{JobInfo, JobRegistry, JobStatus};
use ripemongo_lib::tools::export::{ExportFormat, ExportRequest};

const ORDERS: i32 = 120;

fn request(collection: &str, path: &std::path::Path, format: ExportFormat) -> ExportRequest {
    ExportRequest {
        database: "shop".into(),
        collection: collection.into(),
        path: path.to_string_lossy().into_owned(),
        format,
        fields: Vec::new(),
        json_array: false,
        pretty: false,
        canonical: false,
        header: true,
        query: None,
        sort: None,
        skip: None,
        limit: None,
    }
}

fn succeeded(jobs: &JobRegistry, job: JobInfo) -> String {
    assert_eq!(job.status, JobStatus::Succeeded, "{:?}", jobs.log(&job.id));
    job.summary.unwrap()
}

#[tokio::test]
async fn exports_json_and_csv_with_queries() {
    if !docker_available() || !tools_available() {
        return;
    }
    let (_container, port) = start_mongo().await;
    let (manager, dir) = manager();
    let id = manager
        .save(
            profile("Export", local_config(port)),
            &SecretUpdates::default(),
        )
        .unwrap()
        .id;
    manager.connect(&id).await.unwrap();
    let database = manager.client(&id).await.unwrap().database("shop");
    let orders: Vec<Document> = (0..ORDERS)
        .map(|n| doc! { "n": n, "name": format!("order {n}"), "address": { "city": "Bratislava", "zip": "01234" }, "tags": ["a", "b"] })
        .collect();
    database
        .collection("orders")
        .insert_many(orders)
        .await
        .unwrap();
    database
        .create_collection("big_orders")
        .view_on("orders".to_owned())
        .pipeline([doc! { "$match": { "n": { "$gte": 100 } } }])
        .await
        .unwrap();

    let sample = sample_fields(&database, "orders").await.unwrap();
    assert_eq!(sample.fields, ["_id", "n", "name", "address", "tags"]);
    assert!(sample.paths.contains(&"address.city".to_owned()));
    assert!(!sample.paths.contains(&"address".to_owned()));

    let jobs = registry();

    // JSON lines with a query, a descending sort, skip and limit.
    let lines = dir.path().join("orders.json");
    let mut json = request("orders", &lines, ExportFormat::Json);
    json.query = Some("{ n: { $lt: 50 } }".into());
    json.sort = Some("{ n: -1 }".into());
    json.skip = Some(1);
    json.limit = Some(3);
    json.fields = vec!["n".into(), "name".into()];
    let summary = succeeded(&jobs, export(&manager, &jobs, &id, json).await);
    assert!(summary.starts_with("Exported 3 documents to "), "{summary}");
    let written: Vec<serde_json::Value> = std::fs::read_to_string(&lines)
        .unwrap()
        .lines()
        .map(|line| serde_json::from_str(line).unwrap())
        .collect();
    let numbers: Vec<i64> = written
        .iter()
        .map(|document| document["n"].as_i64().unwrap())
        .collect();
    assert_eq!(numbers, [48, 47, 46]);
    assert!(written[0].get("address").is_none());

    // A pretty canonical JSON array of a view.
    let array = dir.path().join("big.json");
    let mut view = request("big_orders", &array, ExportFormat::Json);
    view.json_array = true;
    view.pretty = true;
    view.canonical = true;
    succeeded(&jobs, export(&manager, &jobs, &id, view).await);
    let text = std::fs::read_to_string(&array).unwrap();
    let documents: Vec<serde_json::Value> = serde_json::from_str(&text).unwrap();
    assert_eq!(documents.len(), 20);
    assert_eq!(documents[0]["n"]["$numberInt"], "100");

    // CSV with nested fields, with and without the header line.
    let csv = dir.path().join("orders.csv");
    let mut table = request("orders", &csv, ExportFormat::Csv);
    table.fields = vec!["n".into(), "address.city".into(), "tags".into()];
    table.limit = Some(2);
    succeeded(&jobs, export(&manager, &jobs, &id, table.clone()).await);
    let text = std::fs::read_to_string(&csv).unwrap();
    let rows: Vec<&str> = text.lines().collect();
    assert_eq!(rows[0], "n,address.city,tags");
    assert_eq!(rows[1], r#"0,Bratislava,"[""a"",""b""]""#);
    table.header = false;
    succeeded(&jobs, export(&manager, &jobs, &id, table).await);
    assert_eq!(std::fs::read_to_string(&csv).unwrap().lines().count(), 2);

    // Missing folders are created; a path that is a folder fails with the tool's reason.
    let nested = dir.path().join("new").join("orders.json");
    let job = export(
        &manager,
        &jobs,
        &id,
        request("orders", &nested, ExportFormat::Json),
    )
    .await;
    succeeded(&jobs, job);
    let job = export(
        &manager,
        &jobs,
        &id,
        request("orders", dir.path(), ExportFormat::Json),
    )
    .await;
    assert_eq!(job.status, JobStatus::Failed);
    let error = job.error.unwrap();
    assert!(
        error.message.starts_with("mongoexport failed: "),
        "{error:?}"
    );
}
