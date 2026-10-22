//! Integration tests: update many / delete many with previews, on a standalone server and on
//! a replica set (where the update preview is simulated in an aborted transaction).

mod common;

use common::*;
use mongodb::bson::{doc, Document};
use mongodb::Database;
use ripemongo_lib::connections::SecretUpdates;
use ripemongo_lib::documents::{
    delete_many, preview_delete_many, preview_update_many, update_many, PREVIEW_SAMPLES,
};
use ripemongo_lib::error::{AppError, ErrorCode};

/// Connects and seeds `shop.items` with five documents; setup failures panic.
#[allow(clippy::unwrap_used)]
async fn connect(port: u16) -> (Database, tempfile::TempDir) {
    let (manager, dir) = manager();
    let saved = manager
        .save(
            profile("Bulk", local_config(port)),
            &SecretUpdates::default(),
        )
        .unwrap();
    manager.connect(&saved.id).await.unwrap();
    let db = manager.client(&saved.id).await.unwrap().database("shop");
    let items = (1..=5).map(|n| doc! { "_id": n, "qty": n, "status": "new" });
    db.collection::<Document>("items")
        .insert_many(items)
        .await
        .unwrap();
    (db, dir)
}

#[tokio::test]
async fn standalone_previews_matches_then_updates_and_deletes() {
    if !docker_available() {
        return;
    }
    let (_container, port) = start_mongo().await;
    let (db, _dir) = connect(port).await;

    let preview = preview_update_many(&db, "items", "{ qty: { $gt: 1 } }", "{ $inc: { qty: 10 } }")
        .await
        .unwrap();
    assert_eq!(preview.matched.count, 4.0);
    assert!(!preview.matched.estimated);
    assert!(!preview.simulated);
    assert_eq!(preview.samples.len(), PREVIEW_SAMPLES as usize);
    assert!(preview.samples.iter().all(|sample| sample.after.is_none()));

    let summary = update_many(&db, "items", "{ qty: { $gt: 1 } }", "{ $inc: { qty: 10 } }")
        .await
        .unwrap();
    assert_eq!((summary.matched, summary.modified), (4.0, 4.0));
    let pipeline = update_many(
        &db,
        "items",
        "{}",
        "[{ $set: { double: { $multiply: ['$qty', 2] } } }]",
    )
    .await
    .unwrap();
    assert_eq!(pipeline.modified, 5.0);
    let stored = db
        .collection::<Document>("items")
        .find_one(doc! { "_id": 2 })
        .await
        .unwrap()
        .unwrap();
    assert_eq!(stored.get_i32("double").unwrap(), 24);

    let replacement = update_many(&db, "items", "{}", "{ qty: 1 }")
        .await
        .unwrap_err();
    assert_eq!(AppError::from(replacement).code, ErrorCode::InvalidInput);

    let delete = preview_delete_many(&db, "items", "{ qty: { $gte: 13 } }")
        .await
        .unwrap();
    assert_eq!(delete.matched.count, 3.0);
    assert_eq!(delete.samples.len(), 3);
    assert_eq!(
        delete_many(&db, "items", "{ qty: { $gte: 13 } }")
            .await
            .unwrap(),
        3.0
    );
    assert_eq!(delete_many(&db, "items", "{}").await.unwrap(), 2.0);
}

#[tokio::test]
async fn replica_set_preview_shows_the_result_without_writing() {
    if !docker_available() {
        return;
    }
    let (_container, port) = start_replica_set().await;
    let (db, _dir) = connect(port).await;
    let items = db.collection::<Document>("items");

    let preview = preview_update_many(
        &db,
        "items",
        "{ _id: { $lte: 2 } }",
        "{ $set: { status: 'done' }, $inc: { qty: 1 } }",
    )
    .await
    .unwrap();
    assert!(preview.simulated);
    assert_eq!(preview.matched.count, 2.0);
    let first = &preview.samples[0];
    assert!(
        first.before.contains(r#""status":"new""#),
        "{}",
        first.before
    );
    let after = first.after.as_deref().unwrap();
    assert!(after.contains(r#""status":"done""#), "{after}");
    assert!(after.contains(r#""qty":{"$numberInt":"2"}"#), "{after}");
    // The transaction was aborted: nothing changed.
    assert_eq!(
        items
            .count_documents(doc! { "status": "done" })
            .await
            .unwrap(),
        0
    );

    // A server-side failure shows up in the preview, before anything is written.
    let invalid = preview_update_many(&db, "items", "{}", "{ $inc: { status: 1 } }")
        .await
        .unwrap_err();
    assert_ne!(AppError::from(invalid).code, ErrorCode::Internal);
    assert_eq!(
        items
            .count_documents(doc! { "status": "new" })
            .await
            .unwrap(),
        5
    );
}
