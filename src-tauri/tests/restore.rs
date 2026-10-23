//! Integration test: dump with `mongodump`, read the dump, then `mongorestore` it with renames,
//! exclusions, drop, dry run and oplog replay. Needs Docker and `pnpm sidecars`.

// Setup helpers should panic loudly, as in `common`.
#![allow(clippy::unwrap_used)]

mod common;

use std::path::Path;

use common::jobs::{dump, registry, restore, tools_available};
use common::*;
use mongodb::bson::{doc, Document};
use mongodb::Database;
use ripemongo_lib::connections::SecretUpdates;
use ripemongo_lib::jobs::{JobInfo, JobRegistry, JobStatus};
use ripemongo_lib::tools::dump::{DumpOutput, DumpRequest};
use ripemongo_lib::tools::restore::{inspect_dump, DatabaseRename, RestoreRequest, RestoreSource};

const ITEMS: i32 = 120;

fn path(path: &Path) -> String {
    path.to_string_lossy().into_owned()
}

fn request(source: RestoreSource) -> RestoreRequest {
    RestoreRequest {
        source,
        exclude: Vec::new(),
        renames: Vec::new(),
        drop: false,
        dry_run: false,
        oplog_replay: false,
        parallel_collections: None,
    }
}

fn succeeded(jobs: &JobRegistry, job: JobInfo) -> String {
    assert_eq!(job.status, JobStatus::Succeeded, "{:?}", jobs.log(&job.id));
    job.summary.unwrap()
}

async fn count(database: &Database, collection: &str) -> u64 {
    database
        .collection::<Document>(collection)
        .count_documents(doc! {})
        .await
        .unwrap()
}

#[tokio::test]
async fn restores_dumps_with_renames_drop_dry_run_and_oplog() {
    if !docker_available() || !tools_available() {
        return;
    }
    let (_container, port) = start_replica_set().await;
    let (manager, dir) = manager();
    let id = manager
        .save(
            profile("Restore", local_config(port)),
            &SecretUpdates::default(),
        )
        .unwrap()
        .id;
    manager.connect(&id).await.unwrap();
    let client = manager.client(&id).await.unwrap();
    let shop = client.database("shop");
    let items: Vec<Document> = (0..ITEMS).map(|n| doc! { "n": n }).collect();
    shop.collection("items").insert_many(items).await.unwrap();
    shop.collection("users")
        .insert_many([doc! { "name": "ann" }, doc! { "name": "bob" }])
        .await
        .unwrap();
    shop.create_collection("cheap")
        .view_on("items".to_owned())
        .pipeline(vec![doc! { "$match": { "n": { "$lt": 5 } } }])
        .await
        .unwrap();
    let jobs = registry();

    // A gzip folder dump of one database, and a gzip archive of the server with its oplog.
    let folder = dir.path().join("dump");
    let mut folder_dump = DumpRequest::new(
        Some("shop".into()),
        None,
        DumpOutput::Folder {
            path: path(&folder),
        },
    );
    folder_dump.gzip = true;
    succeeded(&jobs, dump(&manager, &jobs, &id, folder_dump).await);
    let archive = dir.path().join("all.archive.gz");
    let mut archive_dump = DumpRequest::new(
        None,
        None,
        DumpOutput::Archive {
            path: path(&archive),
        },
    );
    archive_dump.gzip = true;
    archive_dump.oplog = true;
    succeeded(&jobs, dump(&manager, &jobs, &id, archive_dump).await);

    // Both are read back: collections, the view, gzip and the oplog.
    let folder_source = RestoreSource::Folder {
        path: path(&folder),
    };
    let archive_source = RestoreSource::Archive {
        path: path(&archive),
    };
    for (source, oplog) in [(&folder_source, false), (&archive_source, true)] {
        let contents = inspect_dump(source).unwrap();
        assert!(contents.gzip);
        assert_eq!(contents.oplog, oplog);
        let names: Vec<_> = contents
            .namespaces
            .iter()
            .map(|ns| (ns.database.as_str(), ns.collection.as_str(), ns.view))
            .collect();
        assert_eq!(
            names,
            [
                ("shop", "cheap", true),
                ("shop", "items", false),
                ("shop", "users", false)
            ]
        );
    }

    // Into another database, without users (the view counts as a collection).
    let mut copy = request(folder_source.clone());
    copy.exclude = vec!["shop.users".into()];
    copy.renames = vec![DatabaseRename {
        from: "shop".into(),
        to: "copy".into(),
    }];
    let summary = succeeded(&jobs, restore(&manager, &jobs, &id, copy.clone()).await);
    assert!(
        summary.starts_with(&format!("Restored {ITEMS} documents into 2 collections.")),
        "{summary}"
    );
    let copied = client.database("copy");
    assert_eq!(count(&copied, "items").await, u64::try_from(ITEMS).unwrap());
    assert_eq!(count(&copied, "users").await, 0);

    // Again: every document already exists; with drop they are replaced.
    let summary = succeeded(&jobs, restore(&manager, &jobs, &id, copy.clone()).await);
    assert!(summary.contains("could not be restored"), "{summary}");
    copy.drop = true;
    let summary = succeeded(&jobs, restore(&manager, &jobs, &id, copy).await);
    assert!(!summary.contains("could not"), "{summary}");

    // A dry run lists what would happen and writes nothing.
    let mut dry = request(archive_source.clone());
    dry.dry_run = true;
    dry.renames = vec![DatabaseRename {
        from: "shop".into(),
        to: "dry".into(),
    }];
    let summary = succeeded(&jobs, restore(&manager, &jobs, &id, dry).await);
    assert!(summary.starts_with("Dry run: would restore "), "{summary}");
    assert!(summary.contains("shop.items as dry.items"), "{summary}");
    let databases = client.list_database_names().await.unwrap();
    assert!(!databases.contains(&"dry".to_owned()));

    // A point-in-time restore of the whole server.
    let mut full = request(archive_source);
    full.drop = true;
    full.oplog_replay = true;
    let summary = succeeded(&jobs, restore(&manager, &jobs, &id, full).await);
    assert!(summary.contains("Replayed"), "{summary}");
    assert_eq!(count(&shop, "users").await, 2);
}
