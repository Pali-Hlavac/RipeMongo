//! Shared helpers for integration tests that run MongoDB in Docker via testcontainers.
//! Tests skip (with a message) when Docker is not available.

// Test-only helpers: each test binary uses a subset, and setup failures should panic loudly.
#![allow(dead_code, clippy::expect_used)]

pub mod jobs;

use std::sync::Arc;
use std::time::Duration;

use mongodb::bson::doc;
use ripemongo_lib::connections::{
    ConnectionConfig, ConnectionManager, ConnectionProfile, HostPort,
};
use ripemongo_lib::secrets::MemorySecretStore;
use testcontainers_modules::testcontainers::core::{IntoContainerPort, WaitFor};
use testcontainers_modules::testcontainers::runners::AsyncRunner;
use testcontainers_modules::testcontainers::{ContainerAsync, GenericImage, ImageExt};

pub const MONGO_IMAGE: &str = "mongo";
pub const MONGO_TAG: &str = "8.0";
pub const MONGO_PORT: u16 = 27017;
pub const ROOT_USER: &str = "root";
pub const ROOT_PASSWORD: &str = "s3cret-p@ss";
pub const REPLICA_SET: &str = "rs0";
const PRIMARY_POLLS: u32 = 60;
const PRIMARY_POLL_INTERVAL: Duration = Duration::from_millis(500);

/// True when a Docker daemon answers; otherwise the calling test should return early.
pub fn docker_available() -> bool {
    let available = std::process::Command::new("docker")
        .args(["info", "--format", "{{.ServerVersion}}"])
        .output()
        .is_ok_and(|output| output.status.success());
    if !available {
        eprintln!("SKIPPED: Docker is not available; start Docker to run integration tests.");
    }
    available
}

/// Starts MongoDB without authentication.
pub async fn start_mongo() -> (ContainerAsync<GenericImage>, u16) {
    let container = GenericImage::new(MONGO_IMAGE, MONGO_TAG)
        .with_wait_for(WaitFor::message_on_stdout("Waiting for connections"))
        .with_exposed_port(MONGO_PORT.tcp())
        .start()
        .await
        .expect("start mongo container");
    let port = container
        .get_host_port_ipv4(MONGO_PORT)
        .await
        .expect("mapped port");
    (container, port)
}

/// Starts a single-node replica set (transactions work); connect with `directConnection`.
pub async fn start_replica_set() -> (ContainerAsync<GenericImage>, u16) {
    let container = GenericImage::new(MONGO_IMAGE, MONGO_TAG)
        .with_wait_for(WaitFor::message_on_stdout("Waiting for connections"))
        .with_exposed_port(MONGO_PORT.tcp())
        .with_cmd(["--replSet", REPLICA_SET, "--bind_ip_all"])
        .start()
        .await
        .expect("start mongo replica set");
    let port = container
        .get_host_port_ipv4(MONGO_PORT)
        .await
        .expect("mapped port");
    let uri = format!("mongodb://127.0.0.1:{port}/?directConnection=true");
    let admin = mongodb::Client::with_uri_str(uri)
        .await
        .expect("client")
        .database("admin");
    let config = doc! { "_id": REPLICA_SET, "members": [{ "_id": 0, "host": format!("localhost:{MONGO_PORT}") }] };
    admin
        .run_command(doc! { "replSetInitiate": config })
        .await
        .expect("initiate replica set");
    for _ in 0..PRIMARY_POLLS {
        let hello = admin.run_command(doc! { "hello": 1 }).await.expect("hello");
        if hello.get_bool("isWritablePrimary") == Ok(true) {
            return (container, port);
        }
        tokio::time::sleep(PRIMARY_POLL_INTERVAL).await;
    }
    panic!("the replica set member did not become primary");
}

/// Starts MongoDB with a root user (`ROOT_USER` / `ROOT_PASSWORD`).
pub async fn start_mongo_with_auth() -> (ContainerAsync<GenericImage>, u16) {
    let container = GenericImage::new(MONGO_IMAGE, MONGO_TAG)
        .with_wait_for(WaitFor::message_on_stdout("MongoDB init process complete"))
        .with_exposed_port(MONGO_PORT.tcp())
        .with_env_var("MONGO_INITDB_ROOT_USERNAME", ROOT_USER)
        .with_env_var("MONGO_INITDB_ROOT_PASSWORD", ROOT_PASSWORD)
        .start()
        .await
        .expect("start mongo container with auth");
    let port = container
        .get_host_port_ipv4(MONGO_PORT)
        .await
        .expect("mapped port");
    (container, port)
}

/// A manager with a temporary config dir and an in-memory secret store.
pub fn manager() -> (ConnectionManager, tempfile::TempDir) {
    let dir = tempfile::tempdir().expect("temp dir");
    let manager = ConnectionManager::new(dir.path(), Arc::new(MemorySecretStore::default()));
    (manager, dir)
}

/// Config for `127.0.0.1:<port>`.
pub fn local_config(port: u16) -> ConnectionConfig {
    ConnectionConfig {
        hosts: vec![HostPort {
            host: "127.0.0.1".into(),
            port: Some(port),
        }],
        direct_connection: Some(true),
        ..ConnectionConfig::default()
    }
}

/// An unsaved profile wrapping `config`.
pub fn profile(name: &str, config: ConnectionConfig) -> ConnectionProfile {
    ConnectionProfile {
        id: String::new(),
        name: name.into(),
        folder: None,
        favorite: false,
        color: None,
        config,
    }
}
