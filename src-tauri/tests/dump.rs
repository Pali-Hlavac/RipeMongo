//! Integration test: `mongodump` jobs against MongoDB with SCRAM auth (the password reaches
//! the tool through the temporary config file). Needs Docker and `pnpm sidecars`.

// Setup helpers should panic loudly, as in `common`.
#![allow(clippy::unwrap_used)]

mod common;

use std::path::Path;

use common::jobs::{dump, registry, tools_available};
use common::*;
use mongodb::bson::{doc, Document};
use ripemongo_lib::connections::SecretUpdates;
use ripemongo_lib::jobs::JobStatus;
use ripemongo_lib::tools::dump::{DumpOutput, DumpRequest};

const ITEMS: i32 = 250;

fn path(path: &Path) -> String {
    path.to_string_lossy().into_owned()
}

fn shop(collection: Option<&str>, output: DumpOutput) -> DumpRequest {
    DumpRequest::new(Some("shop".into()), collection.map(Into::into), output)
}

#[tokio::test]
async fn dumps_with_options_and_reports_failures() {
    if !docker_available() || !tools_available() {
        return;
    }
    let (_container, port) = start_mongo_with_auth().await;
    let (manager, dir) = manager();
    let id = connect_with_auth(&manager, "Dump", port).await;
    let database = manager.client(&id).await.unwrap().database("shop");
    let items: Vec<Document> = (0..ITEMS).map(|n| doc! { "n": n }).collect();
    database
        .collection("items")
        .insert_many(items)
        .await
        .unwrap();
    database
        .collection("users")
        .insert_many([doc! { "name": "ann" }, doc! { "name": "bob" }])
        .await
        .unwrap();
    database
        .collection("tmp_import")
        .insert_one(doc! { "x": 1 })
        .await
        .unwrap();
    let jobs = registry();

    // A database into a folder, leaving out one prefix, two collections at a time.
    let folder = dir.path().join("dump");
    let mut request = shop(
        None,
        DumpOutput::Folder {
            path: path(&folder),
        },
    );
    request.exclude_prefixes = vec!["tmp_".into()];
    request.parallel_collections = Some(2);
    let job = dump(&manager, &jobs, &id, request).await;
    assert_eq!(job.status, JobStatus::Succeeded, "{:?}", jobs.log(&job.id));
    let progress = job.progress.unwrap();
    assert_eq!((progress.done, progress.total), (252.0, Some(252.0)));
    assert!(job
        .summary
        .unwrap()
        .starts_with("Dumped 2 collections (252 documents)"));
    assert!(folder.join("shop").join("items.bson").is_file());
    assert!(!folder.join("shop").join("tmp_import.bson").exists());
    assert!(job.log_lines > 0.0);

    // Part of one collection (shell-syntax filter) into a gzip archive.
    let archive = dir.path().join("items.archive.gz");
    let mut request = shop(
        Some("items"),
        DumpOutput::Archive {
            path: path(&archive),
        },
    );
    request.gzip = true;
    request.query = Some("{ n: { $lt: NumberInt(10) } }".into());
    let job = dump(&manager, &jobs, &id, request).await;
    assert_eq!(job.status, JobStatus::Succeeded, "{:?}", jobs.log(&job.id));
    assert_eq!(job.progress.unwrap().total, Some(10.0));
    assert!(job
        .summary
        .unwrap()
        .starts_with("Dumped 1 collection (10 documents)"));
    assert!(std::fs::metadata(&archive).unwrap().len() > 0);

    // A folder that does not exist: the tool's own reason becomes the error.
    let missing = dir.path().join("missing").join("x.archive");
    let job = dump(
        &manager,
        &jobs,
        &id,
        shop(
            None,
            DumpOutput::Archive {
                path: path(&missing),
            },
        ),
    )
    .await;
    assert_eq!(job.status, JobStatus::Failed);
    let error = job.error.unwrap();
    assert!(error.message.starts_with("mongodump failed: "), "{error:?}");
}

#[tokio::test]
async fn dumps_a_replica_set_with_its_oplog() {
    if !docker_available() || !tools_available() {
        return;
    }
    let (_container, port) = start_replica_set().await;
    let (manager, dir) = manager();
    let saved = manager
        .save(
            profile("Replica set", local_config(port)),
            &SecretUpdates::default(),
        )
        .unwrap();
    manager.connect(&saved.id).await.unwrap();
    let client = manager.client(&saved.id).await.unwrap();
    client
        .database("shop")
        .collection("items")
        .insert_many([doc! { "n": 1 }, doc! { "n": 2 }])
        .await
        .unwrap();
    let jobs = registry();

    let folder = dir.path().join("dump");
    let mut request = DumpRequest::new(
        None,
        None,
        DumpOutput::Folder {
            path: path(&folder),
        },
    );
    request.oplog = true;
    let job = dump(&manager, &jobs, &saved.id, request).await;
    let log = jobs.log(&job.id);
    assert_eq!(job.status, JobStatus::Succeeded, "{log:?}");
    assert!(folder.join("oplog.bson").is_file(), "{log:?}");
    // admin.system.version is part of a whole-server dump.
    let summary = job.summary.unwrap();
    assert!(
        summary.starts_with("Dumped 2 collections (3 documents) and 1 oplog entry to "),
        "{summary}"
    );
}
