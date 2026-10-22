//! Integration tests: connecting through a real OpenSSH server to a MongoDB that is only
//! reachable on a private Docker network (password and key auth, host key checks).

// Setup helpers should panic loudly, as in `common`.
#![allow(clippy::expect_used, clippy::unwrap_used)]

mod common;

use std::time::{SystemTime, UNIX_EPOCH};

use common::*;
use mongodb::bson::{doc, Document};
use ripemongo_lib::connections::{
    ConnectionConfig, ConnectionManager, HostPort, SecretUpdate, SecretUpdates, SshAuthMethod,
    SshConfig,
};
use ripemongo_lib::error::{AppError, ErrorCode};
use testcontainers_modules::testcontainers::core::{ExecCommand, IntoContainerPort, WaitFor};
use testcontainers_modules::testcontainers::runners::AsyncRunner;
use testcontainers_modules::testcontainers::{ContainerAsync, GenericImage, ImageExt};

const SSHD_IMAGE: &str = "panubo/sshd";
const SSHD_TAG: &str = "1.5.0";
const SSH_PORT: u16 = 22;
const SSH_USER: &str = "tester";
const SSH_PASSWORD: &str = "tunnel-test-pw";
const KEY_PATH: &str = "/home/tester/.ssh/id_ed25519";

/// Host keys, a user with a password and an authorized ed25519 key, forwarding allowed.
const SSHD_SETUP: &str = "ssh-keygen -A \
    && adduser -D tester && echo 'tester:tunnel-test-pw' | chpasswd \
    && mkdir -p /home/tester/.ssh \
    && ssh-keygen -q -t ed25519 -N '' -f /home/tester/.ssh/id_ed25519 \
    && cp /home/tester/.ssh/id_ed25519.pub /home/tester/.ssh/authorized_keys \
    && chown -R tester:tester /home/tester/.ssh && chmod 700 /home/tester/.ssh \
    && exec /usr/sbin/sshd -D -e -o AllowTcpForwarding=yes -o PasswordAuthentication=yes";

struct Bastion {
    _mongo: ContainerAsync<GenericImage>,
    sshd: ContainerAsync<GenericImage>,
    mongo_host: String,
    ssh_port: u16,
}

/// MongoDB and sshd on a fresh network; MongoDB publishes no port to the host.
async fn start_bastion() -> Bastion {
    let suffix = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|elapsed| elapsed.as_nanos())
        .unwrap_or_default();
    let network = format!("ripemongo-ssh-{suffix}");
    let mongo_host = format!("ripemongo-mongo-{suffix}");
    let mongo = GenericImage::new(MONGO_IMAGE, MONGO_TAG)
        .with_wait_for(WaitFor::message_on_stdout("Waiting for connections"))
        .with_network(&network)
        .with_container_name(&mongo_host)
        .start()
        .await
        .expect("start mongo");
    let sshd = GenericImage::new(SSHD_IMAGE, SSHD_TAG)
        .with_wait_for(WaitFor::message_on_stderr("Server listening on"))
        .with_exposed_port(SSH_PORT.tcp())
        .with_entrypoint("/bin/sh")
        .with_cmd(["-c", SSHD_SETUP])
        .with_network(&network)
        .start()
        .await
        .expect("start sshd");
    let ssh_port = sshd
        .get_host_port_ipv4(SSH_PORT)
        .await
        .expect("mapped ssh port");
    Bastion {
        _mongo: mongo,
        sshd,
        mongo_host,
        ssh_port,
    }
}

impl Bastion {
    fn config(&self, auth: SshAuthMethod) -> ConnectionConfig {
        ConnectionConfig {
            hosts: vec![HostPort {
                host: self.mongo_host.clone(),
                port: Some(MONGO_PORT),
            }],
            direct_connection: Some(true),
            ssh: Some(SshConfig {
                host: "127.0.0.1".into(),
                port: self.ssh_port,
                username: SSH_USER.into(),
                auth,
            }),
            ..ConnectionConfig::default()
        }
    }

    /// Runs a command in the sshd container and returns its standard output.
    async fn exec(&self, command: &str) -> String {
        let mut result = self
            .sshd
            .exec(ExecCommand::new(["/bin/sh", "-c", command]))
            .await
            .expect("exec in sshd");
        String::from_utf8(result.stdout_to_vec().await.expect("stdout")).expect("utf-8")
    }
}

fn ssh_password(value: &str) -> SecretUpdates {
    SecretUpdates {
        ssh_password: SecretUpdate::Set(value.into()),
        ..SecretUpdates::default()
    }
}

/// Saves a profile and connects; setup failures (saving) panic.
async fn connect(
    manager: &ConnectionManager,
    config: ConnectionConfig,
    secrets: &SecretUpdates,
) -> Result<String, AppError> {
    let saved = manager.save(profile("Tunnel", config), secrets).unwrap();
    manager.connect(&saved.id).await?;
    Ok(saved.id)
}

#[tokio::test]
async fn tunnels_with_password_and_key_and_rejects_bad_credentials_and_changed_keys() {
    if !docker_available() {
        return;
    }
    let bastion = start_bastion().await;
    let (manager, dir) = manager();

    // Password: the first connection trusts and records the host key.
    let id = connect(
        &manager,
        bastion.config(SshAuthMethod::Password),
        &ssh_password(SSH_PASSWORD),
    )
    .await
    .unwrap();
    let info = manager.connect(&id).await.unwrap();
    assert!(info.via_ssh);
    let items = manager
        .client(&id)
        .await
        .unwrap()
        .database("shop")
        .collection::<Document>("items");
    items.insert_one(doc! { "via": "ssh" }).await.unwrap();
    assert_eq!(
        items.count_documents(doc! { "via": "ssh" }).await.unwrap(),
        1
    );
    manager.disconnect(&id).await;

    // Private key generated inside the container (nothing is committed).
    let key_file = dir.path().join("id_ed25519");
    std::fs::write(&key_file, bastion.exec(&format!("cat {KEY_PATH}")).await).unwrap();
    let key_auth = SshAuthMethod::PrivateKey {
        key_file: key_file.to_string_lossy().into_owned(),
    };
    let key_id = connect(
        &manager,
        bastion.config(key_auth),
        &SecretUpdates::default(),
    )
    .await
    .unwrap();
    manager.disconnect(&key_id).await;

    // Wrong password.
    let wrong = connect(
        &manager,
        bastion.config(SshAuthMethod::Password),
        &ssh_password("not-the-password"),
    )
    .await
    .unwrap_err();
    assert_eq!(wrong.code, ErrorCode::SshFailed);

    // A different key recorded for this host:port means the server cannot be trusted.
    let known_hosts = dir.path().join("known_hosts");
    let recorded = std::fs::read_to_string(&known_hosts).unwrap();
    // russh starts the file with an empty line.
    let line = recorded
        .lines()
        .find(|line| !line.trim().is_empty())
        .unwrap();
    let mut fields = line.split_whitespace();
    let (host, key_type) = (fields.next().unwrap(), fields.next().unwrap());
    let algorithm = if key_type == "ssh-ed25519" {
        "ed25519"
    } else if key_type.starts_with("ecdsa") {
        "ecdsa"
    } else {
        "rsa"
    };
    let other = bastion
        .exec(&format!(
            "ssh-keygen -q -t {algorithm} -N '' -f /tmp/other && cat /tmp/other.pub"
        ))
        .await;
    let other_key = other.split_whitespace().nth(1).unwrap();
    std::fs::write(&known_hosts, format!("{host} {key_type} {other_key}\n")).unwrap();
    let changed = manager.connect(&id).await.unwrap_err();
    assert_eq!(AppError::from(changed).code, ErrorCode::SshFailed);
}
