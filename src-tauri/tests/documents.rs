//! Integration tests: paged `find` and counting against a real MongoDB server.

mod common;

use common::*;
use mongodb::bson::{doc, Document};
use ripemongo_lib::connections::SecretUpdates;
use ripemongo_lib::documents::{count_documents, find_documents, FindRequest};
use ripemongo_lib::error::{AppError, ErrorCode};

const TOTAL: i32 = 25;

fn request(filter: &str, skip: u32, limit: u32) -> FindRequest {
    FindRequest {
        filter: filter.to_owned(),
        projection: String::new(),
        sort: "{ n: 1 }".to_owned(),
        collation: String::new(),
        skip,
        limit,
        max_time_ms: Some(10_000),
    }
}

/// Values of the `n` field, read from canonical Extended JSON.
#[allow(clippy::expect_used)]
fn numbers(documents: &[String]) -> Vec<i64> {
    documents
        .iter()
        .map(|json| {
            let value: serde_json::Value = serde_json::from_str(json).expect("valid JSON");
            value["n"]["$numberInt"]
                .as_str()
                .and_then(|n| n.parse().ok())
                .expect("an Int32 field n")
        })
        .collect()
}

#[tokio::test]
async fn pages_filters_projects_and_counts() {
    if !docker_available() {
        return;
    }
    let (_container, port) = start_mongo().await;
    let (manager, _dir) = manager();
    let saved = manager
        .save(
            profile("Docs", local_config(port)),
            &SecretUpdates::default(),
        )
        .unwrap();
    manager.connect(&saved.id).await.unwrap();
    let db = manager.client(&saved.id).await.unwrap().database("shop");
    let docs: Vec<Document> = (0..TOTAL)
        .map(|n| doc! { "n": n, "even": n % 2 == 0, "name": format!("Item {n}") })
        .collect();
    db.collection::<Document>("items")
        .insert_many(docs)
        .await
        .unwrap();

    // Paging: one extra document tells whether more follow.
    let first = find_documents(&db, "items", &request("", 0, 10))
        .await
        .unwrap();
    assert_eq!(numbers(&first.documents), (0..10).collect::<Vec<_>>());
    assert!(first.has_more);
    let last = find_documents(&db, "items", &request("", 20, 10))
        .await
        .unwrap();
    assert_eq!(numbers(&last.documents), (20..25).collect::<Vec<_>>());
    assert!(!last.has_more);
    let exact = find_documents(&db, "items", &request("", 15, 10))
        .await
        .unwrap();
    assert!(!exact.has_more, "exactly the remaining documents");

    // Shell syntax filter, projection keeps field order and types (canonical EJSON).
    let mut filtered = request("{ even: true, n: { $gte: 20 } }", 0, 10);
    filtered.projection = "{ _id: 0, n: 1, name: 1 }".to_owned();
    let page = find_documents(&db, "items", &filtered).await.unwrap();
    assert_eq!(numbers(&page.documents), vec![20, 22, 24]);
    assert_eq!(
        page.documents[0],
        r#"{"n":{"$numberInt":"20"},"name":"Item 20"}"#
    );

    // Counts: estimated without a filter, exact with one.
    let all = count_documents(&db, "items", "", None).await.unwrap();
    assert_eq!(all.count, f64::from(TOTAL));
    assert!(all.estimated);
    let even = count_documents(&db, "items", "{ even: true }", None)
        .await
        .unwrap();
    assert_eq!(even.count, 13.0);
    assert!(!even.estimated);

    // Bad input is reported with the part that is wrong.
    let error = AppError::from(
        find_documents(&db, "items", &request("{ n: ", 0, 10))
            .await
            .unwrap_err(),
    );
    assert_eq!(error.code, ErrorCode::InvalidInput);
    assert!(error.message.starts_with("Filter: "), "{}", error.message);
    let too_big = find_documents(&db, "items", &request("", 0, 5000)).await;
    assert!(too_big.is_err());
}
