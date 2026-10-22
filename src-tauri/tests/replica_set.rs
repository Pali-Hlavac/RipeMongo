//! Integration tests: the main read and write paths against a (single-node) replica set,
//! which is what most real deployments are, including Atlas.

mod common;

use common::*;
use ripemongo_lib::collections::{collection_stats, list_collections};
use ripemongo_lib::connections::{SecretUpdates, TopologyKind};
use ripemongo_lib::databases::{create_database, list_databases};
use ripemongo_lib::documents::{
    count_documents, delete_document, find_documents, insert_documents, replace_document,
    FindRequest,
};
use ripemongo_lib::error::{AppError, ErrorCode};

fn request(filter: &str) -> FindRequest {
    FindRequest {
        filter: filter.into(),
        projection: String::new(),
        sort: "{ n: 1 }".into(),
        collation: String::new(),
        skip: 0,
        limit: 2,
        max_time_ms: Some(5_000),
    }
}

#[tokio::test]
async fn browses_and_edits_a_replica_set() {
    if !docker_available() {
        return;
    }
    let (_container, port) = start_replica_set().await;
    let (manager, _dir) = manager();
    let saved = manager
        .save(
            profile("Replica set", local_config(port)),
            &SecretUpdates::default(),
        )
        .unwrap();

    let info = manager.connect(&saved.id).await.unwrap();
    assert_eq!(info.server.topology, TopologyKind::ReplicaSet);
    assert_eq!(info.server.replica_set_name.as_deref(), Some(REPLICA_SET));
    assert!(info.server.writable);

    let client = manager.client(&saved.id).await.unwrap();
    create_database(&client, "shop", "items").await.unwrap();
    let names: Vec<_> = list_databases(&client)
        .await
        .unwrap()
        .into_iter()
        .map(|database| database.name)
        .collect();
    assert!(names.iter().any(|name| name == "shop"), "{names:?}");
    let db = client.database("shop");
    assert_eq!(list_collections(&db).await.unwrap()[0].name, "items");

    let inserted = insert_documents(&db, "items", "[{ n: 1 }, { n: 2 }, { n: 3, tag: 'x' }]")
        .await
        .unwrap();
    assert_eq!(inserted, 3);
    let page = find_documents(&db, "items", &request("{}")).await.unwrap();
    assert_eq!(page.documents.len(), 2);
    assert!(page.has_more);
    let exact = count_documents(&db, "items", "{ n: { $gte: 2 } }", None)
        .await
        .unwrap();
    assert_eq!((exact.count, exact.estimated), (2.0, false));
    assert_eq!(
        collection_stats(&db, "items").await.unwrap().document_count,
        3.0
    );

    // Replace through the optimistic check, then delete.
    let first = &find_documents(&db, "items", &request("{ n: 1 }"))
        .await
        .unwrap()
        .documents[0];
    let parsed: serde_json::Value = serde_json::from_str(first).unwrap();
    let id = &parsed["_id"].to_string();
    replace_document(&db, "items", id, first, "{ n: 10 }")
        .await
        .unwrap();
    let stale = replace_document(&db, "items", id, first, "{ n: 11 }")
        .await
        .unwrap_err();
    assert_eq!(AppError::from(stale).code, ErrorCode::Conflict);
    delete_document(&db, "items", id).await.unwrap();
    let left = count_documents(&db, "items", "{}", None).await.unwrap();
    assert_eq!(left.count, 2.0);
}
