//! Tests for reading dumps and building `mongorestore` arguments.

use std::path::Path;

use super::*;
use crate::tools::run::OutputParser;

fn write(path: &Path, bytes: &[u8]) {
    std::fs::create_dir_all(path.parent().unwrap()).unwrap();
    std::fs::write(path, bytes).unwrap();
}

fn folder(dir: &Path) -> RestoreSource {
    RestoreSource::Folder {
        path: dir.to_string_lossy().into_owned(),
    }
}

#[test]
fn lists_collections_views_and_the_oplog_of_a_folder() {
    let dir = tempfile::tempdir().unwrap();
    let root = dir.path();
    write(&root.join("shop/items.bson.gz"), b"12345");
    write(&root.join("shop/items.metadata.json.gz"), b"");
    write(&root.join("shop/cheap.metadata.json.gz"), b"");
    write(&root.join("admin/system.version.bson.gz"), b"");
    write(&root.join("oplog.bson"), b"");
    write(&root.join("prelude.json.gz"), b"");

    let contents = inspect_dump(&folder(root)).unwrap();
    assert!(contents.gzip);
    assert!(contents.oplog);
    let names: Vec<_> = contents
        .namespaces
        .iter()
        .map(|ns| (ns.database.as_str(), ns.collection.as_str(), ns.view))
        .collect();
    assert_eq!(names, [("shop", "cheap", true), ("shop", "items", false)]);
    assert_eq!(contents.namespaces[1].size, 5.0);
}

#[test]
fn explains_folders_that_are_not_a_dump() {
    let dir = tempfile::tempdir().unwrap();
    write(&dir.path().join("items.bson"), b"");
    let error = inspect_dump(&folder(dir.path())).unwrap_err().to_string();
    assert!(error.contains("folder of one database"), "{error}");

    let empty = tempfile::tempdir().unwrap();
    assert!(inspect_dump(&folder(empty.path())).is_err());
    let relative = RestoreSource::Folder {
        path: "dump".into(),
    };
    assert!(inspect_dump(&relative).is_err());
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

fn archive() -> RestoreSource {
    RestoreSource::Archive {
        path: std::env::temp_dir()
            .join("nightly.archive")
            .to_string_lossy()
            .into_owned(),
    }
}

#[test]
fn builds_arguments() {
    let mut restore = request(archive());
    restore.exclude = vec!["shop.logs".into(), "shop.a*b".into()];
    restore.renames = vec![
        DatabaseRename {
            from: "shop".into(),
            to: "shop_copy".into(),
        },
        DatabaseRename {
            from: "crm".into(),
            to: "crm".into(),
        },
    ];
    restore.drop = true;
    restore.parallel_collections = Some(2);
    let args = restore.args(true).unwrap();
    assert_eq!(
        args[1..],
        [
            "--gzip",
            "--nsExclude=shop.logs",
            r"--nsExclude=shop.a\*b",
            "--nsFrom=shop.*",
            "--nsTo=shop_copy.*",
            "--drop",
            "--numParallelCollections=2",
        ]
    );
    assert!(args[0].starts_with("--archive="));
    assert_eq!(restore.title(), "Restore nightly.archive");

    let mut dry = request(archive());
    dry.dry_run = true;
    dry.oplog_replay = true;
    assert_eq!(
        dry.args(false).unwrap()[1..],
        ["--oplogReplay", "--dryRun", "--verbose=1"]
    );
    assert_eq!(dry.title(), "Check restore of nightly.archive");
}

#[test]
fn rejects_invalid_requests() {
    let relative = request(RestoreSource::Folder {
        path: "dump".into(),
    });
    assert!(relative.args(false).is_err());

    let mut bad_name = request(archive());
    bad_name.renames = vec![DatabaseRename {
        from: "shop".into(),
        to: "my shop".into(),
    }];
    let error = bad_name.args(false).unwrap_err().to_string();
    assert!(error.contains("cannot be a database name"), "{error}");

    let mut partial_oplog = request(archive());
    partial_oplog.oplog_replay = true;
    partial_oplog.exclude = vec!["shop.logs".into()];
    assert!(partial_oplog.args(false).is_err());

    let mut parallel = request(archive());
    parallel.parallel_collections = Some(0);
    assert!(parallel.args(false).is_err());
}

#[test]
fn counts_finished_collections_and_failures() {
    let mut progress = RestoreProgress::default();
    let started = progress
        .line(r"restoring `copy.items` from `folder\shop\items.bson`")
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
fn measures_folder_restores_in_bytes() {
    let mib = 1_048_576.0;
    let sizes = [
        ("copy.items".to_owned(), 12.7 * mib),
        ("copy.users".to_owned(), 100.0),
    ];
    let mut progress = RestoreProgress::new(sizes.into_iter().collect());
    let bar = progress
        .line("[####....]  copy.items  5.45MB/12.7MB  (43.1%)")
        .unwrap();
    assert_eq!(bar.unit, crate::jobs::ProgressUnit::Bytes);
    assert_eq!(bar.total, Some(12.7 * mib + 100.0));
    assert!((bar.done - 5.45 * mib).abs() < 1.0);
    let users = progress
        .line("finished restoring `copy.users` (2 documents, 0 failures)")
        .unwrap();
    assert!((users.done - (5.45 * mib + 100.0)).abs() < 1.0);
    let items = progress
        .line("finished restoring `copy.items` (300 documents, 0 failures)")
        .unwrap();
    assert_eq!(items.done, items.total.unwrap());
    assert_eq!(progress::parse_size("1.5KB"), Some(1536.0));
    assert_eq!(progress::parse_size("shop"), None);
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
    progress.line("applied 0 oplog entries");
    assert!(progress
        .summary(false)
        .ends_with("The oplog had no changes to replay."));

    let mut dry = RestoreProgress::default();
    assert!(dry.summary(true).contains("nothing in the dump matches"));
    dry.line("found collection `shop.items` bson to restore to `shop.items`");
    dry.line("found collection metadata from `shop.items` to restore to `shop.items`");
    dry.line("found collection `shop.users` bson to restore to `copy.users`");
    dry.line("found collection `.oplog` bson to restore to `.oplog`");
    dry.line("found collection `admin.system.version` bson to restore to `admin.system.version`");
    assert_eq!(
        dry.summary(true),
        "Dry run: would restore 2 collections: shop.items, shop.users as copy.users. Nothing was written."
    );
}
