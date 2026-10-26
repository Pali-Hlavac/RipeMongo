//! Integration test: copy collections and databases with `mongodump` piped into
//! `mongorestore`, from a server without auth into one with SCRAM auth, and within one
//! server. Needs Docker and `pnpm sidecars`.

// Setup helpers should panic loudly, as in `common`.
#![allow(clippy::unwrap_used)]

mod common;

use common::jobs::{copy, registry, start_copy_job, tools_available};
use common::*;
use mongodb::bson::{doc, Document};
use mongodb::{Client, Database};
use ripemongo_lib::connections::SecretUpdates;
use ripemongo_lib::jobs::{JobInfo, JobRegistry, JobStatus};
use ripemongo_lib::tools::copy::CopyRequest;

const ITEMS: i32 = 300;
const CHEAP: i32 = 100;
/// Longer than the 255 bytes MongoDB allows for `database.collection`.
const TOO_LONG: usize = 300;

fn succeeded(jobs: &JobRegistry, job: &JobInfo) -> String {
    let log = jobs.log(&job.id).unwrap();
    assert_eq!(job.status, JobStatus::Succeeded, "{job:?} {log:?}");
    assert!(
        log.iter().any(|line| line.starts_with("mongodump: ")),
        "{log:?}"
    );
    assert!(
        log.iter().any(|line| line.starts_with("mongorestore: ")),
        "{log:?}"
    );
    assert!(
        !log.iter().any(|line| line.contains(ROOT_PASSWORD)),
        "{log:?}"
    );
    job.summary.clone().unwrap()
}

async fn count(database: &Database, collection: &str) -> u64 {
    database
        .collection::<Document>(collection)
        .count_documents(doc! {})
        .await
        .unwrap()
}

async fn index_names(database: &Database, collection: &str) -> Vec<String> {
    database
        .collection::<Document>(collection)
        .list_index_names()
        .await
        .unwrap()
}

async fn seed(client: &Client) {
    let shop = client.database("shop");
    let items: Vec<Document> = (0..ITEMS).map(|n| doc! { "n": n, "tag": n % 3 }).collect();
    shop.collection("items").insert_many(items).await.unwrap();
    shop.collection::<Document>("items")
        .create_index(
            mongodb::IndexModel::builder()
                .keys(doc! { "tag": 1 })
                .build(),
        )
        .await
        .unwrap();
    shop.collection("users")
        .insert_many([doc! { "name": "ann" }, doc! { "name": "bob" }])
        .await
        .unwrap();
    shop.collection("logs")
        .insert_one(doc! { "line": 1 })
        .await
        .unwrap();
    shop.create_collection("cheap")
        .view_on("items".to_owned())
        .pipeline(vec![doc! { "$match": { "n": { "$lt": CHEAP } } }])
        .await
        .unwrap();
}

#[tokio::test]
async fn copies_between_connections_and_within_one() {
    if !docker_available() || !tools_available() {
        return;
    }
    let ((_source_container, source_port), (_target_container, target_port)) =
        tokio::join!(start_mongo(), start_mongo_with_auth());
    let (manager, _dir) = manager();
    let save = |name: &str| {
        manager
            .save(
                profile(name, local_config(source_port)),
                &SecretUpdates::default(),
            )
            .unwrap()
            .id
    };
    let source = save("Source");
    let same_server = save("Source again");
    manager.connect(&source).await.unwrap();
    manager.connect(&same_server).await.unwrap();
    let target = connect_with_auth(&manager, "Target", target_port).await;
    let source_client = manager.client(&source).await.unwrap();
    let target_client = manager.client(&target).await.unwrap();
    seed(&source_client).await;
    let shop = source_client.database("shop");
    let jobs = registry();

    // A collection with a query, under another name, with its index.
    let mut first = CopyRequest::new("shop", Some("items"));
    first.target_database = "copy".into();
    first.target_collection = Some("cheap_items".into());
    first.query = Some(format!("{{ n: {{ $lt: {CHEAP} }} }}"));
    let job = copy(&manager, &jobs, (&source, &target), first).await;
    assert_eq!(job.title, "Copy shop.items to copy.cheap_items on Target");
    assert_eq!(
        succeeded(&jobs, &job),
        "Copied 100 documents (1 collection) to copy.cheap_items on Target."
    );
    let copied = target_client.database("copy");
    assert_eq!(count(&copied, "cheap_items").await, 100);
    assert!(index_names(&copied, "cheap_items")
        .await
        .contains(&"tag_1".to_owned()));

    // A database without one collection; the view comes along.
    let mut database = CopyRequest::new("shop", None);
    database.exclude_collections = vec!["logs".into()];
    let job = copy(&manager, &jobs, (&source, &target), database.clone()).await;
    assert!(succeeded(&jobs, &job).starts_with("Copied 302 documents"));
    let target_shop = target_client.database("shop");
    assert_eq!(
        count(&target_shop, "items").await,
        u64::try_from(ITEMS).unwrap()
    );
    assert_eq!(count(&target_shop, "cheap").await, 100);
    let names = target_shop.list_collection_names().await.unwrap();
    assert!(!names.contains(&"logs".to_owned()), "{names:?}");

    // Again: every document already exists. With drop and without indexes it replaces them.
    let job = copy(&manager, &jobs, (&source, &target), database.clone()).await;
    let summary = succeeded(&jobs, &job);
    assert!(
        summary.contains("302 documents could not be copied"),
        "{summary}"
    );
    database.drop = true;
    database.indexes = false;
    let job = copy(&manager, &jobs, (&source, &target), database).await;
    assert!(succeeded(&jobs, &job).starts_with("Copied 302 documents"));
    assert_eq!(
        index_names(&target_shop, "items").await,
        vec!["_id_".to_owned()]
    );

    // Onto itself: refused, also through another saved connection to the same server.
    let mut onto_itself = CopyRequest::new("shop", Some("items"));
    onto_itself.drop = true;
    for ends in [(source.as_str(), source.as_str()), (&source, &same_server)] {
        let error = start_copy_job(&manager, &jobs, ends, onto_itself.clone())
            .await
            .unwrap_err();
        assert!(error.to_string().contains("copied onto itself"), "{error}");
    }
    assert_eq!(count(&shop, "items").await, u64::try_from(ITEMS).unwrap());
    let mut whole = CopyRequest::new("shop", None);
    whole.drop = true;
    let error = start_copy_job(&manager, &jobs, (&source, &same_server), whole)
        .await
        .unwrap_err();
    assert!(error.to_string().contains("copied onto itself"), "{error}");

    // Within one server under another name.
    let mut backup = CopyRequest::new("shop", Some("items"));
    backup.target_collection = Some("items_backup".into());
    let job = copy(&manager, &jobs, (&source, &source), backup).await;
    assert_eq!(job.title, "Copy shop.items to shop.items_backup");
    succeeded(&jobs, &job);
    assert_eq!(
        count(&shop, "items_backup").await,
        u64::try_from(ITEMS).unwrap()
    );

    // The server refuses the target name: mongorestore is blamed, not mongodump's pipe.
    let mut refused = CopyRequest::new("shop", Some("items"));
    refused.target_collection = Some("x".repeat(TOO_LONG));
    let job = copy(&manager, &jobs, (&source, &target), refused).await;
    assert_eq!(job.status, JobStatus::Failed, "{:?}", jobs.log(&job.id));
    let error = job.error.unwrap().message;
    assert!(error.starts_with("mongorestore failed: "), "{error}");
}
