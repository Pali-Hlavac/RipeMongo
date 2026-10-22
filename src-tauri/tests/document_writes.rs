//! Integration tests: inserting, editing and deleting documents against a real server.

mod common;

use common::*;
use mongodb::bson::{doc, Document};
use ripemongo_lib::connections::SecretUpdates;
use ripemongo_lib::documents::{
    delete_document, insert_documents, replace_document, set_field, FieldEdit,
};
use ripemongo_lib::ejson::to_canonical_json;
use ripemongo_lib::error::{AppError, ErrorCode};
use ripemongo_lib::mongo::MongoError;

fn code(error: MongoError) -> ErrorCode {
    AppError::from(error).code
}

#[tokio::test]
async fn inserts_edits_and_deletes_with_conflict_checks() {
    if !docker_available() {
        return;
    }
    let (_container, port) = start_mongo().await;
    let (manager, _dir) = manager();
    let saved = manager
        .save(
            profile("Writes", local_config(port)),
            &SecretUpdates::default(),
        )
        .unwrap();
    manager.connect(&saved.id).await.unwrap();
    let db = manager.client(&saved.id).await.unwrap().database("shop");
    let items = db.collection::<Document>("items");

    // Insert one and many, in shell syntax.
    let one = insert_documents(&db, "items", r#"{ _id: 1, name: "Pen", qty: 3 }"#)
        .await
        .unwrap();
    assert_eq!(one, 1);
    let many = insert_documents(&db, "items", r#"[{ _id: 2, name: "Ink" }, { _id: 3 }]"#)
        .await
        .unwrap();
    assert_eq!(many, 2);
    let duplicate = insert_documents(&db, "items", "{ _id: 1 }")
        .await
        .unwrap_err();
    assert_eq!(code(duplicate), ErrorCode::InvalidInput);

    // Replace keeps _id, refuses to change it, and refuses stale originals.
    let loaded = items.find_one(doc! { "_id": 1 }).await.unwrap().unwrap();
    let original = to_canonical_json(loaded);
    let id = r#"{"$numberInt":"1"}"#;
    replace_document(&db, "items", id, &original, r#"{ name: "Pen", qty: 5 }"#)
        .await
        .unwrap();
    let stored = items.find_one(doc! { "_id": 1 }).await.unwrap().unwrap();
    assert_eq!(stored, doc! { "_id": 1, "name": "Pen", "qty": 5 });
    let stale = replace_document(&db, "items", id, &original, "{ qty: 9 }")
        .await
        .unwrap_err();
    assert_eq!(code(stale), ErrorCode::Conflict);
    let current = to_canonical_json(stored);
    let changed_id = replace_document(&db, "items", id, &current, "{ _id: 99 }")
        .await
        .unwrap_err();
    assert_eq!(code(changed_id), ErrorCode::InvalidInput);

    // Inline field edit guarded by the original value.
    let edit = |original_value: &str, value: &str| FieldEdit {
        id: id.to_owned(),
        path: "qty".to_owned(),
        original_value: original_value.to_owned(),
        value: value.to_owned(),
    };
    set_field(&db, "items", &edit("5", "NumberLong(6)"))
        .await
        .unwrap();
    let stored = items.find_one(doc! { "_id": 1 }).await.unwrap().unwrap();
    assert_eq!(stored.get_i64("qty").unwrap(), 6);
    let stale = set_field(&db, "items", &edit("5", "7")).await.unwrap_err();
    assert_eq!(code(stale), ErrorCode::Conflict);

    // A validator rejection is the user's input problem, not a server failure.
    db.create_collection("strict")
        .validator(doc! { "$jsonSchema": { "required": ["name"] } })
        .await
        .unwrap();
    let invalid = insert_documents(&db, "strict", "{ qty: 1 }")
        .await
        .unwrap_err();
    assert_eq!(code(invalid), ErrorCode::InvalidInput);

    // Delete once; the second time it is gone.
    delete_document(&db, "items", r#"{"$numberInt":"2"}"#)
        .await
        .unwrap();
    let gone = delete_document(&db, "items", r#"{"$numberInt":"2"}"#)
        .await
        .unwrap_err();
    assert_eq!(code(gone), ErrorCode::NotFound);
    assert_eq!(items.count_documents(doc! {}).await.unwrap(), 2);
}
