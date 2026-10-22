//! Integration test: `mongodump` jobs against MongoDB with SCRAM auth (the password reaches
//! the tool through the temporary config file). Needs Docker and `pnpm sidecars`.

// Setup helpers should panic loudly, as in `common`.
#![allow(clippy::unwrap_used)]

mod common;

use std::path::Path;
use std::sync::Arc;
use std::time::Duration;

use common::*;
use mongodb::bson::{doc, Document};
use ripemongo_lib::connections::{
    AuthConfig, ConnectionConfig, ConnectionManager, ScramVariant, SecretUpdate, SecretUpdates,
};
use ripemongo_lib::jobs::{JobEvents, JobInfo, JobRegistry, JobStatus};
use ripemongo_lib::tools::dump::{start_dump, DumpOutput, DumpRequest};
use ripemongo_lib::tools::{locate, Tool};

/// The auth container restarts mongod after init; retry until it accepts connections.
const READY_ATTEMPTS: usize = 30;
const READY_DELAY: Duration = Duration::from_millis(500);
/// How long a dump of a few hundred documents may take.
const JOB_TIMEOUT: Duration = Duration::from_secs(60);
const ITEMS: i32 = 250;

struct NoEvents;

impl JobEvents for NoEvents {
    fn updated(&self, _job: &JobInfo) {}
    fn logged(&self, _job_id: &str, _lines: &[String]) {}
}

async fn connect_with_auth(manager: &ConnectionManager, port: u16) -> String {
    let config = ConnectionConfig {
        auth: AuthConfig::Scram {
            username: ROOT_USER.into(),
            auth_source: Some("admin".into()),
            variant: ScramVariant::Sha256,
        },
        ..local_config(port)
    };
    let secrets = SecretUpdates {
        password: SecretUpdate::Set(ROOT_PASSWORD.into()),
        ..SecretUpdates::default()
    };
    let saved = manager.save(profile("Dump", config), &secrets).unwrap();
    for _ in 0..READY_ATTEMPTS {
        if manager.connect(&saved.id).await.is_ok() {
            return saved.id;
        }
        tokio::time::sleep(READY_DELAY).await;
    }
    panic!("server never accepted the password");
}

async fn finished(jobs: &JobRegistry, id: &str) -> JobInfo {
    tokio::time::timeout(JOB_TIMEOUT, async {
        loop {
            let job = jobs.list().into_iter().find(|job| job.id == id).unwrap();
            if job.status != JobStatus::Running {
                return job;
            }
            tokio::time::sleep(Duration::from_millis(50)).await;
        }
    })
    .await
    .unwrap()
}

async fn dump(
    manager: &ConnectionManager,
    jobs: &JobRegistry,
    id: &str,
    request: DumpRequest,
) -> JobInfo {
    let connection = manager.tool_connection(id).await.unwrap();
    let started = start_dump(jobs, id.to_owned(), connection, request).unwrap();
    let command = started.command.unwrap();
    assert!(command.starts_with("mongodump --uri="), "{command}");
    assert!(!command.contains(ROOT_PASSWORD), "{command}");
    finished(jobs, &started.id).await
}

fn path(path: &Path) -> String {
    path.to_string_lossy().into_owned()
}

#[tokio::test]
async fn dumps_databases_and_collections_and_reports_failures() {
    if !docker_available() {
        return;
    }
    if locate(Tool::Mongodump).is_err() {
        eprintln!("skipped: run `pnpm sidecars` to fetch the MongoDB tools");
        return;
    }
    let (_container, port) = start_mongo_with_auth().await;
    let (manager, dir) = manager();
    let id = connect_with_auth(&manager, port).await;
    let shop = manager.client(&id).await.unwrap().database("shop");
    let items: Vec<Document> = (0..ITEMS).map(|n| doc! { "n": n }).collect();
    shop.collection("items").insert_many(items).await.unwrap();
    shop.collection("users")
        .insert_many([doc! { "name": "ann" }, doc! { "name": "bob" }])
        .await
        .unwrap();
    let jobs = JobRegistry::new(Arc::new(NoEvents));

    // A database into a folder.
    let folder = dir.path().join("dump");
    let job = dump(
        &manager,
        &jobs,
        &id,
        DumpRequest {
            database: Some("shop".into()),
            collection: None,
            output: DumpOutput::Folder {
                path: path(&folder),
            },
            gzip: false,
        },
    )
    .await;
    assert_eq!(job.status, JobStatus::Succeeded, "{:?}", jobs.log(&job.id));
    let progress = job.progress.unwrap();
    assert_eq!((progress.done, progress.total), (252.0, Some(252.0)));
    assert!(job
        .summary
        .unwrap()
        .starts_with("Dumped 2 collections (252 documents)"));
    assert!(folder.join("shop").join("items.bson").is_file());
    assert!(job.log_lines > 0.0);

    // One collection into a gzip archive.
    let archive = dir.path().join("items.archive.gz");
    let job = dump(
        &manager,
        &jobs,
        &id,
        DumpRequest {
            database: Some("shop".into()),
            collection: Some("items".into()),
            output: DumpOutput::Archive {
                path: path(&archive),
            },
            gzip: true,
        },
    )
    .await;
    assert_eq!(job.status, JobStatus::Succeeded, "{:?}", jobs.log(&job.id));
    assert!(job
        .summary
        .unwrap()
        .starts_with("Dumped 1 collection (250 documents)"));
    assert!(std::fs::metadata(&archive).unwrap().len() > 0);

    // A folder that does not exist: the tool's own reason becomes the error.
    let missing = dir.path().join("missing").join("x.archive");
    let job = dump(
        &manager,
        &jobs,
        &id,
        DumpRequest {
            database: Some("shop".into()),
            collection: None,
            output: DumpOutput::Archive {
                path: path(&missing),
            },
            gzip: false,
        },
    )
    .await;
    assert_eq!(job.status, JobStatus::Failed);
    let error = job.error.unwrap();
    assert!(error.message.starts_with("mongodump failed: "), "{error:?}");
}
