//! Tests for reading dumps and building `mongorestore` arguments.

use std::path::Path;

use super::*;

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
    write(&root.join("shop/items.bson.gz"), b"");
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
