//! Tests for the saved dumps store.

use super::*;
use crate::tools::dump::{DumpOutput, DumpRequest};

fn store(dir: &tempfile::TempDir) -> DumpProfiles {
    DumpProfiles::new(dir.path().join("dump-profiles.json"))
}

fn input(name: &str, connection_id: &str) -> DumpProfileInput {
    let path = std::env::temp_dir()
        .join("dump")
        .to_string_lossy()
        .into_owned();
    DumpProfileInput {
        id: None,
        name: name.into(),
        connection_id: connection_id.into(),
        request: DumpRequest::new(Some("shop".into()), None, DumpOutput::Folder { path }),
    }
}

#[test]
fn creates_updates_runs_and_deletes() {
    let dir = tempfile::tempdir().unwrap();
    let store = store(&dir);
    let nightly = store.save(input(" Nightly ", "c1")).unwrap();
    assert_eq!(nightly.name, "Nightly");
    assert!(nightly.last_run_at.is_none());

    let mut changes = input("Nightly shop", "c1");
    changes.id = Some(nightly.id.clone());
    changes.request.gzip = true;
    let updated = store.save(changes).unwrap();
    assert_eq!(updated.id, nightly.id);
    assert_eq!(updated.created_at, nightly.created_at);
    assert!(updated.request.gzip);

    store.mark_run(&nightly.id).unwrap();
    assert!(store.get(&nightly.id).unwrap().last_run_at.is_some());
    assert_eq!(store.list().unwrap().len(), 1);

    store.delete(&nightly.id).unwrap();
    assert!(matches!(
        store.get(&nightly.id),
        Err(DumpProfilesError::NotFound)
    ));
    store.delete("gone").unwrap();
}

#[test]
fn rejects_blank_names_invalid_settings_and_unknown_ids() {
    let dir = tempfile::tempdir().unwrap();
    let store = store(&dir);
    assert!(store.save(input("  ", "c1")).is_err());
    let mut relative = input("Relative", "c1");
    relative.request.output = DumpOutput::Folder {
        path: "dump".into(),
    };
    assert!(matches!(
        store.save(relative),
        Err(DumpProfilesError::Request(_))
    ));
    let mut unknown = input("Unknown", "c1");
    unknown.id = Some("missing".into());
    assert!(matches!(
        store.save(unknown),
        Err(DumpProfilesError::NotFound)
    ));
    assert!(store.list().unwrap().is_empty());
}

#[test]
fn forgetting_a_connection_removes_only_its_dumps() {
    let dir = tempfile::tempdir().unwrap();
    let store = store(&dir);
    store.save(input("A", "c1")).unwrap();
    store.save(input("B", "c2")).unwrap();
    store.forget_connection("c1").unwrap();
    let names: Vec<_> = store
        .list()
        .unwrap()
        .into_iter()
        .map(|profile| profile.name)
        .collect();
    assert_eq!(names, ["B"]);
}
