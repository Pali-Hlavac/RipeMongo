//! Unit tests for copy requests, their arguments and progress.

use super::*;
use crate::tools::pipe::PipeOutputParser;

fn strings(items: &[&str]) -> Vec<String> {
    items.iter().map(|item| (*item).to_owned()).collect()
}

#[test]
fn copies_a_collection_under_another_name() {
    let mut request = CopyRequest::new("shop", Some("orders"));
    request.target_database = "copy".into();
    request.target_collection = Some("orders_2026".into());
    request.query = Some("{ total: { $gt: 5 } }".into());
    request.indexes = false;
    request.drop = true;
    assert_eq!(
        request.title(Some("Staging")),
        "Copy shop.orders to copy.orders_2026 on Staging"
    );
    assert_eq!(
        request.dump_args().unwrap(),
        strings(&[
            "--db=shop",
            "--collection=orders",
            r#"--query={"total":{"$gt":{"$numberInt":"5"}}}"#,
            "--archive",
        ])
    );
    assert_eq!(
        request.restore_args().unwrap(),
        strings(&[
            "--archive",
            "--nsFrom=shop.orders",
            "--nsTo=copy.orders_2026",
            "--drop",
            "--noIndexRestore",
        ])
    );
}

#[test]
fn copies_a_database_and_renames_only_when_needed() {
    let mut request = CopyRequest::new("shop", None);
    request.exclude_collections = vec!["logs".into()];
    request.exclude_prefixes = vec!["tmp_".into()];
    assert_eq!(request.title(None), "Copy shop to shop");
    assert_eq!(
        request.dump_args().unwrap(),
        strings(&[
            "--db=shop",
            "--excludeCollection=logs",
            "--excludeCollectionsWithPrefix=tmp_",
            "--archive",
        ])
    );
    assert_eq!(request.restore_args().unwrap(), strings(&["--archive"]));

    request.target_database = "a$b".into();
    assert!(request.restore_args().is_err());
    request.target_database = "shop_copy".into();
    assert_eq!(
        request.restore_args().unwrap(),
        strings(&["--archive", "--nsFrom=shop.*", "--nsTo=shop_copy.*"])
    );
}

#[test]
fn escapes_namespace_patterns() {
    let mut request = CopyRequest::new("shop", Some("a*b"));
    request.target_collection = Some("c\\d".into());
    assert_eq!(
        request.restore_args().unwrap()[1..],
        strings(&["--nsFrom=shop.a\\*b", "--nsTo=shop.c\\\\d"])
    );
}

#[test]
fn rejects_incomplete_requests() {
    let mut no_target = CopyRequest::new("shop", Some("orders"));
    no_target.target_collection = Some(" ".into());
    assert!(no_target.restore_args().is_err());
    no_target.target_collection = Some("system.x".into());
    assert!(no_target.restore_args().is_err());
    let mut no_database = CopyRequest::new("shop", None);
    no_database.target_database = String::new();
    assert!(no_database.restore_args().is_err());
    assert!(CopyRequest::new(" ", None).dump_args().is_err());
    assert!(CopyRequest::new("shop", Some(" ")).dump_args().is_err());
    let mut query = CopyRequest::new("shop", None);
    query.query = Some("{ a: 1 }".into());
    assert!(query.dump_args().is_err());
}

#[test]
fn reports_dump_progress_indexes_and_restore_counts() {
    let mut progress = CopyProgress::new(Some(5_001.0));
    assert!(progress
        .line(
            Tool::Mongorestore,
            "restoring indexes for collection `copy.orders` from metadata"
        )
        .is_none());
    let bar = progress
        .line(
            Tool::Mongodump,
            "[####....]  shop.orders  2000/5000  (40.0%)",
        )
        .unwrap();
    assert_eq!((bar.done, bar.total), (2_000.0, Some(5_001.0)));
    progress.line(
        Tool::Mongodump,
        "done dumping `shop.orders` (5000 documents)",
    );
    progress.line(
        Tool::Mongorestore,
        "finished restoring `copy.orders` (5000 documents, 0 failures)",
    );
    progress.line(
        Tool::Mongorestore,
        "finished restoring `copy.users` (1 document, 2 failures)",
    );
    let indexes = progress
        .line(
            Tool::Mongorestore,
            "restoring indexes for collection `copy.orders` from metadata",
        )
        .unwrap();
    assert_eq!(indexes.done, 5_000.0);
    assert_eq!(
        indexes.message.as_deref(),
        Some("Creating the indexes of copy.orders")
    );
    assert_eq!(
        progress.summary("copy on Staging"),
        "Copied 5,001 documents (2 collections) to copy on Staging. 2 documents could not be \
         copied, for example because a document with the same _id already exists in the \
         target; the log lists them."
    );
}
