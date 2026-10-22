//! Integration tests: databases and collections against a real MongoDB server.

mod common;

use common::*;
use mongodb::bson::{doc, Document};
use ripemongo_lib::collections::{
    collection_stats, create_collection, create_view, drop_collection, list_collections,
    rename_collection, CollectionKind, NewCollectionOptions, NewView, TimeSeriesGranularity,
};
use ripemongo_lib::connections::SecretUpdates;
use ripemongo_lib::databases::{create_database, drop_database, list_databases};
use ripemongo_lib::error::{AppError, ErrorCode};
use ripemongo_lib::mongo::MongoError;

fn code(error: MongoError) -> ErrorCode {
    AppError::from(error).code
}

#[tokio::test]
async fn manages_databases_and_collections_end_to_end() {
    if !docker_available() {
        return;
    }
    let (_container, port) = start_mongo().await;
    let (manager, _dir) = manager();
    let saved = manager
        .save(
            profile("Catalog", local_config(port)),
            &SecretUpdates::default(),
        )
        .unwrap();

    // Not connected yet: a clear error, not a hang.
    let not_connected = manager.client(&saved.id).await.unwrap_err();
    assert_eq!(AppError::from(not_connected).code, ErrorCode::NotConnected);

    manager.connect(&saved.id).await.unwrap();
    let client = manager.client(&saved.id).await.unwrap();

    create_database(&client, "shop", "orders").await.unwrap();
    let names: Vec<_> = list_databases(&client)
        .await
        .unwrap()
        .into_iter()
        .map(|d| d.name)
        .collect();
    assert!(names.contains(&"shop".to_owned()), "{names:?}");

    let db = client.database("shop");
    create_collection(
        &db,
        "log",
        &NewCollectionOptions::Capped {
            size_bytes: 65_536.0,
            max_documents: Some(10.0),
        },
    )
    .await
    .unwrap();
    create_collection(
        &db,
        "metrics",
        &NewCollectionOptions::TimeSeries {
            time_field: "ts".into(),
            meta_field: Some("sensor".into()),
            granularity: Some(TimeSeriesGranularity::Minutes),
            expire_after_seconds: Some(86_400.0),
        },
    )
    .await
    .unwrap();
    create_view(
        &db,
        &NewView {
            name: "big_orders".into(),
            view_on: "orders".into(),
            pipeline: "[{ $match: { total: { $gt: 100 } } }]".into(),
        },
    )
    .await
    .unwrap();

    let collections = list_collections(&db).await.unwrap();
    let kind = |name: &str| {
        collections
            .iter()
            .find(|c| c.name == name)
            .map(|c| (c.kind, c.capped))
    };
    assert_eq!(kind("orders"), Some((CollectionKind::Collection, false)));
    assert_eq!(kind("log"), Some((CollectionKind::Collection, true)));
    assert_eq!(kind("metrics"), Some((CollectionKind::Timeseries, false)));
    assert_eq!(kind("big_orders"), Some((CollectionKind::View, false)));
    assert!(collections.iter().all(|c| !c.name.starts_with("system.")));

    let orders = db.collection::<Document>("orders");
    orders
        .insert_many(vec![doc! { "total": 50 }, doc! { "total": 150 }])
        .await
        .unwrap();
    let stats = collection_stats(&db, "orders").await.unwrap();
    assert_eq!(stats.document_count, 2.0);
    assert!(stats.size > 0.0 && stats.average_document_size > 0.0);

    // MongoDB 7+ accepts re-creating an identical collection, but not with other options.
    create_collection(&db, "orders", &NewCollectionOptions::Standard)
        .await
        .unwrap();
    let capped = NewCollectionOptions::Capped {
        size_bytes: 4096.0,
        max_documents: None,
    };
    let exists = create_collection(&db, "orders", &capped).await.unwrap_err();
    assert_eq!(code(exists), ErrorCode::InvalidInput);

    rename_collection(&db, "orders", "sales").await.unwrap();
    let after_rename: Vec<_> = list_collections(&db)
        .await
        .unwrap()
        .into_iter()
        .map(|c| c.name)
        .collect();
    assert!(
        after_rename.contains(&"sales".to_owned()) && !after_rename.contains(&"orders".to_owned())
    );
    let rename_missing = rename_collection(&db, "nope", "x").await.unwrap_err();
    assert_eq!(code(rename_missing), ErrorCode::NotFound);

    drop_collection(&db, "log").await.unwrap();
    assert!(list_collections(&db)
        .await
        .unwrap()
        .iter()
        .all(|c| c.name != "log"));

    drop_database(&client, "shop").await.unwrap();
    let names: Vec<_> = list_databases(&client)
        .await
        .unwrap()
        .into_iter()
        .map(|d| d.name)
        .collect();
    assert!(!names.contains(&"shop".to_owned()));
}
