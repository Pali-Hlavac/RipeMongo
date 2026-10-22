//! Unit tests for connection import/export.

use std::sync::Arc;

use super::*;
use crate::connections::{AuthConfig, ConnectionConfig, ScramVariant, SecretUpdate, SecretUpdates};
use crate::secrets::MemorySecretStore;

fn manager(dir: &tempfile::TempDir) -> ConnectionManager {
    ConnectionManager::new(dir.path(), Arc::new(MemorySecretStore::default()))
}

fn save_with_password(manager: &ConnectionManager, name: &str) -> ConnectionProfile {
    let profile = ConnectionProfile {
        id: String::new(),
        name: name.into(),
        folder: Some("Team".into()),
        favorite: true,
        color: None,
        config: ConnectionConfig {
            auth: AuthConfig::Scram {
                username: "app".into(),
                auth_source: None,
                variant: ScramVariant::Auto,
            },
            ..ConnectionConfig::default()
        },
    };
    let updates = SecretUpdates {
        password: SecretUpdate::Set("pw".into()),
        ..SecretUpdates::default()
    };
    manager.save(profile, &updates).unwrap()
}

#[test]
fn export_without_password_omits_secrets() {
    let (source_dir, target_dir) = (tempfile::tempdir().unwrap(), tempfile::tempdir().unwrap());
    let source = manager(&source_dir);
    let saved = save_with_password(&source, "Prod");

    let raw = source
        .export_connections(std::slice::from_ref(&saved.id), None)
        .unwrap();
    assert!(!raw.contains("\"pw\""));
    let info = inspect_connections_file(&raw).unwrap();
    assert_eq!(info.connection_count, 1);
    assert!(!info.has_encrypted_secrets);

    let target = manager(&target_dir);
    let summary = target.import_connections(&raw, None).unwrap();
    assert_eq!(summary.imported, 1);
    assert!(!summary.secrets_imported);
    let imported = &target.list().unwrap()[0];
    assert_eq!(imported.name, "Prod");
    assert_eq!(imported.folder.as_deref(), Some("Team"));
    assert!(!target.stored_secrets(&imported.id).unwrap().password);
}

#[test]
fn encrypted_export_restores_secrets_with_the_right_password() {
    let (source_dir, target_dir) = (tempfile::tempdir().unwrap(), tempfile::tempdir().unwrap());
    let source = manager(&source_dir);
    let saved = save_with_password(&source, "Prod");
    let raw = source
        .export_connections(&[saved.id], Some("export-pass"))
        .unwrap();
    assert!(!raw.contains("\"pw\""));
    assert!(
        inspect_connections_file(&raw)
            .unwrap()
            .has_encrypted_secrets
    );

    let target = manager(&target_dir);
    assert!(matches!(
        target.import_connections(&raw, Some("nope")),
        Err(TransferError::WrongPassword)
    ));
    assert!(
        target.list().unwrap().is_empty(),
        "failed import must not save anything"
    );

    let summary = target
        .import_connections(&raw, Some("export-pass"))
        .unwrap();
    assert!(summary.secrets_imported);
    let imported = &target.list().unwrap()[0];
    assert!(target.stored_secrets(&imported.id).unwrap().password);
}

#[test]
fn import_never_overwrites_existing_ids() {
    let dir = tempfile::tempdir().unwrap();
    let manager = manager(&dir);
    let saved = save_with_password(&manager, "Prod");
    let raw = manager
        .export_connections(std::slice::from_ref(&saved.id), None)
        .unwrap();
    manager.import_connections(&raw, None).unwrap();
    let all = manager.list().unwrap();
    assert_eq!(all.len(), 2);
    assert_ne!(all[0].id, all[1].id);
}

#[test]
fn rejects_foreign_and_future_files() {
    assert!(matches!(
        inspect_connections_file("{\"hello\": 1}"),
        Err(TransferError::InvalidFile(_))
    ));
    let future =
        r#"{"format":"ripemongo-connections","version":99,"connections":[],"secrets":null}"#;
    assert!(matches!(
        inspect_connections_file(future),
        Err(TransferError::UnsupportedVersion(99))
    ));
}
