//! Unit tests for dump requests and their `mongodump` arguments.

use super::*;

fn absolute(name: &str) -> String {
    std::env::temp_dir()
        .join(name)
        .to_string_lossy()
        .into_owned()
}

fn folder() -> DumpOutput {
    DumpOutput::Folder {
        path: absolute("dump"),
    }
}

fn request(database: Option<&str>, collection: Option<&str>) -> DumpRequest {
    DumpRequest::new(
        database.map(Into::into),
        collection.map(Into::into),
        folder(),
    )
}

#[test]
fn builds_arguments_for_each_scope() {
    let collection = request(Some("shop"), Some("orders"));
    assert_eq!(collection.title(), "Dump shop.orders");
    assert_eq!(
        collection.args().unwrap(),
        vec![
            "--db=shop".to_owned(),
            "--collection=orders".to_owned(),
            format!("--out={}", absolute("dump")),
        ]
    );

    let archive = absolute("all.archive");
    let mut server = DumpRequest::new(
        None,
        None,
        DumpOutput::Archive {
            path: archive.clone(),
        },
    );
    server.gzip = true;
    server.oplog = true;
    server.parallel_collections = Some(2);
    assert_eq!(server.title(), "Dump all databases");
    assert_eq!(
        server.args().unwrap(),
        vec![
            format!("--archive={archive}"),
            "--gzip".to_owned(),
            "--oplog".to_owned(),
            "--numParallelCollections=2".to_owned(),
        ]
    );
}

#[test]
fn passes_queries_as_canonical_extended_json() {
    let mut orders = request(Some("shop"), Some("orders"));
    orders.query = Some(r#"{ total: { $gt: 5 }, at: ISODate("2026-01-02T00:00:00Z") }"#.into());
    let args = orders.args().unwrap();
    assert_eq!(
        args[2],
        r#"--query={"total":{"$gt":{"$numberInt":"5"}},"at":{"$date":{"$numberLong":"1767312000000"}}}"#
    );
    orders.query = Some(" {} ".into());
    assert_eq!(orders.args().unwrap().len(), 3);
    orders.query = Some("{ total: ".into());
    let error = orders.args().unwrap_err().to_string();
    assert!(
        error.starts_with("The query filter is not valid"),
        "{error}"
    );
}

#[test]
fn leaves_out_collections_and_prefixes() {
    let mut shop = request(Some("shop"), None);
    shop.exclude_collections = vec!["logs".into(), " ".into()];
    shop.exclude_prefixes = vec!["tmp_".into()];
    assert_eq!(
        shop.args().unwrap()[1..3],
        [
            "--excludeCollection=logs".to_owned(),
            "--excludeCollectionsWithPrefix=tmp_".to_owned(),
        ]
    );
    assert!(shop.leaves_out("logs"));
    assert!(shop.leaves_out("tmp_import"));
    assert!(!shop.leaves_out("orders"));
}

#[test]
fn rejects_options_outside_their_scope() {
    assert!(request(None, Some("orders")).args().is_err());
    let mut relative = request(Some("shop"), None);
    relative.output = DumpOutput::Folder {
        path: "dump".into(),
    };
    assert!(relative.args().is_err());
    let mut empty = request(Some("shop"), None);
    empty.output = DumpOutput::Archive { path: " ".into() };
    assert!(empty.args().is_err());

    let mut query = request(Some("shop"), None);
    query.query = Some("{ a: 1 }".into());
    assert!(query.args().is_err());
    let mut oplog = request(Some("shop"), None);
    oplog.oplog = true;
    assert!(oplog.args().is_err());
    let mut excludes = request(Some("shop"), Some("orders"));
    excludes.exclude_prefixes = vec!["tmp_".into()];
    assert!(excludes.args().is_err());
    for parallel in [0, MAX_PARALLEL_COLLECTIONS + 1] {
        let mut server = request(None, None);
        server.parallel_collections = Some(parallel);
        assert!(server.args().is_err());
    }
}
