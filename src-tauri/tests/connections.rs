//! Integration tests: saving, testing and opening connections against real MongoDB servers.

mod common;

use std::time::Duration;

use common::*;
use ripemongo_lib::connections::{
    AuthConfig, ConnectionConfig, ConnectionError, ScramVariant, SecretUpdate, SecretUpdates,
    TopologyKind, UriOption,
};
use ripemongo_lib::error::{AppError, ErrorCode};

/// The auth container restarts mongod after init; retry until it accepts connections.
const READY_ATTEMPTS: usize = 30;
const READY_DELAY: Duration = Duration::from_millis(500);

fn password(value: &str) -> SecretUpdates {
    SecretUpdates {
        password: SecretUpdate::Set(value.into()),
        ..SecretUpdates::default()
    }
}

fn scram_config(port: u16) -> ConnectionConfig {
    ConnectionConfig {
        auth: AuthConfig::Scram {
            username: ROOT_USER.into(),
            auth_source: Some("admin".into()),
            variant: ScramVariant::Sha256,
        },
        ..local_config(port)
    }
}

fn error_code(error: ConnectionError) -> ErrorCode {
    AppError::from(error).code
}

#[tokio::test]
async fn connects_lists_and_disconnects_without_auth() {
    if !docker_available() {
        return;
    }
    let (_container, port) = start_mongo().await;
    let (manager, _dir) = manager();
    let saved = manager
        .save(
            profile("Local", local_config(port)),
            &SecretUpdates::default(),
        )
        .unwrap();

    let info = manager.connect(&saved.id).await.unwrap();
    assert_eq!(info.server.topology, TopologyKind::Standalone);
    assert!(info.server.version.starts_with("8."));
    assert!(!info.via_ssh);
    assert_eq!(manager.active().await.len(), 1);

    // Connecting again reuses the live client.
    assert_eq!(manager.connect(&saved.id).await.unwrap(), info);

    manager.disconnect(&saved.id).await;
    assert!(manager.active().await.is_empty());
}

#[tokio::test]
async fn scram_accepts_stored_password_and_rejects_wrong_one() {
    if !docker_available() {
        return;
    }
    let (_container, port) = start_mongo_with_auth().await;
    let (manager, _dir) = manager();
    let saved = manager
        .save(
            profile("Auth", scram_config(port)),
            &password(ROOT_PASSWORD),
        )
        .unwrap();
    assert!(manager.stored_secrets(&saved.id).unwrap().password);

    let mut connected = None;
    for _ in 0..READY_ATTEMPTS {
        match manager.connect(&saved.id).await {
            Ok(info) => {
                connected = Some(info);
                break;
            }
            Err(_) => tokio::time::sleep(READY_DELAY).await,
        }
    }
    assert!(
        connected.is_some(),
        "server never accepted the stored password"
    );

    // Testing with an overriding wrong password must fail as an auth error.
    let error = manager
        .test(&scram_config(port), Some(&saved.id), &password("wrong"))
        .await
        .unwrap_err();
    assert_eq!(error_code(error), ErrorCode::AuthFailed);
}

#[tokio::test]
async fn unreachable_server_fails_fast_with_connection_error() {
    let (manager, _dir) = manager();
    let config = ConnectionConfig {
        extra_options: vec![UriOption {
            key: "serverSelectionTimeoutMS".into(),
            value: "500".into(),
        }],
        // Port 9 (discard) is essentially never a MongoDB server.
        ..local_config(9)
    };
    let error = manager
        .test(&config, None, &SecretUpdates::default())
        .await
        .unwrap_err();
    assert_eq!(error_code(error), ErrorCode::ConnectionFailed);
}

#[tokio::test]
async fn duplicate_copies_secrets_and_delete_removes_them() {
    let (manager, _dir) = manager();
    let original = manager
        .save(profile("Prod", scram_config(27017)), &password("pw"))
        .unwrap();

    let copy = manager.duplicate(&original.id).unwrap();
    assert_eq!(copy.name, "Prod (copy)");
    assert_ne!(copy.id, original.id);
    assert!(manager.stored_secrets(&copy.id).unwrap().password);

    manager.delete(&copy.id).await.unwrap();
    assert!(!manager.stored_secrets(&copy.id).unwrap().password);
    assert_eq!(manager.list().unwrap().len(), 1);
}

#[tokio::test]
async fn invalid_profiles_are_rejected_before_saving() {
    let (manager, _dir) = manager();
    let error = manager
        .save(
            profile("  ", ConnectionConfig::default()),
            &SecretUpdates::default(),
        )
        .unwrap_err();
    assert_eq!(error_code(error), ErrorCode::InvalidInput);
    assert!(manager.list().unwrap().is_empty());
}
