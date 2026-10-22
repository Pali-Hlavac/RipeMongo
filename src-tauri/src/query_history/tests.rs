//! Tests for the query history store.

use super::*;

const NS: Namespace<'static> = Namespace {
    connection_id: "c1",
    database: "shop",
    collection: "orders",
};

fn history(dir: &tempfile::TempDir) -> QueryHistory {
    QueryHistory::new(dir.path().join("query-history.json"))
}

fn filter(text: &str) -> QueryParts {
    QueryParts {
        filter: text.into(),
        ..QueryParts::default()
    }
}

#[test]
fn records_most_recent_first_without_duplicates() {
    let dir = tempfile::tempdir().unwrap();
    let store = history(&dir);
    store.record(NS, filter("{ a: 1 }")).unwrap();
    store.record(NS, filter("{ b: 1 }")).unwrap();
    let queries = store.record(NS, filter(" { a: 1 } ")).unwrap();
    let filters: Vec<_> = queries
        .recent
        .iter()
        .map(|q| q.query.filter.as_str())
        .collect();
    assert_eq!(filters, [" { a: 1 } ", "{ b: 1 }"]);
    assert!(
        store
            .record(NS, QueryParts::default())
            .unwrap()
            .recent
            .len()
            == 2
    );
}

#[test]
fn keeps_a_bounded_history_per_collection() {
    let dir = tempfile::tempdir().unwrap();
    let store = history(&dir);
    for n in 0..(MAX_RECENT + 5) {
        store.record(NS, filter(&format!("{{ n: {n} }}"))).unwrap();
    }
    assert_eq!(store.list(NS).unwrap().recent.len(), MAX_RECENT);
    let other = Namespace {
        collection: "users",
        ..NS
    };
    assert!(store.list(other).unwrap().recent.is_empty());
}

#[test]
fn favorites_are_named_replaced_by_name_and_deleted() {
    let dir = tempfile::tempdir().unwrap();
    let store = history(&dir);
    assert!(store.save_favorite(NS, "  ", filter("{}x")).is_err());
    assert!(store
        .save_favorite(NS, "Empty", QueryParts::default())
        .is_err());
    store
        .save_favorite(NS, "Open", filter("{ open: true }"))
        .unwrap();
    let queries = store
        .save_favorite(NS, "Open", filter("{ open: 1 }"))
        .unwrap();
    assert_eq!(queries.favorites.len(), 1);
    assert_eq!(queries.favorites[0].query.filter, "{ open: 1 }");
    let id = queries.favorites[0].id.clone();
    assert!(store.delete_favorite(NS, &id).unwrap().favorites.is_empty());
}
