//! Local port forwarding over SSH: `127.0.0.1:<random port>` → SSH server → MongoDB host.

use std::path::PathBuf;
use std::sync::{Arc, Mutex};
use std::time::Duration;

use russh::client::{self, Handle};
use russh::keys::{load_secret_key, PrivateKeyWithHashAlg};
use tokio::net::{TcpListener, TcpStream};
use tokio::task::JoinHandle;

use super::host_keys::HostKeyVerifier;
use super::SshError;
use crate::connections::{SshAuthMethod, SshConfig};

/// Loopback address the tunnel listens on.
pub const LOOPBACK: &str = "127.0.0.1";
/// Maximum time to establish and authenticate the SSH session.
const CONNECT_TIMEOUT: Duration = Duration::from_secs(15);
/// Keepalive interval so idle tunnels survive NAT timeouts.
const KEEPALIVE_INTERVAL: Duration = Duration::from_secs(30);

/// Secrets needed to authenticate against the SSH server.
#[derive(Debug, Clone, Default)]
pub struct SshCredentials {
    pub password: Option<String>,
    pub key_passphrase: Option<String>,
}

/// A running tunnel. Dropping it stops accepting new local connections; the SSH session
/// closes once the last forwarded connection ends.
#[derive(Debug)]
pub struct SshTunnel {
    local_port: u16,
    accept_task: JoinHandle<()>,
}

impl SshTunnel {
    /// Connects and authenticates to the SSH server, then forwards a random local port to
    /// `target_host:target_port` as seen from the SSH server.
    pub async fn open(
        config: &SshConfig,
        credentials: &SshCredentials,
        target_host: &str,
        target_port: u16,
        app_known_hosts: PathBuf,
    ) -> Result<Self, SshError> {
        let session = tokio::time::timeout(
            CONNECT_TIMEOUT,
            connect_and_authenticate(config, credentials, app_known_hosts),
        )
        .await
        .map_err(|_| SshError::Timeout)??;

        let listener = TcpListener::bind((LOOPBACK, 0))
            .await
            .map_err(SshError::LocalPort)?;
        let local_port = listener.local_addr().map_err(SshError::LocalPort)?.port();
        let target = (target_host.to_owned(), target_port);
        let accept_task = tokio::spawn(accept_loop(listener, Arc::new(session), target));
        tracing::info!(local_port, ssh_host = %config.host, "SSH tunnel open");
        Ok(Self {
            local_port,
            accept_task,
        })
    }

    /// Local port that forwards to the target.
    pub fn local_port(&self) -> u16 {
        self.local_port
    }
}

impl Drop for SshTunnel {
    fn drop(&mut self) {
        self.accept_task.abort();
    }
}

async fn connect_and_authenticate(
    config: &SshConfig,
    credentials: &SshCredentials,
    app_known_hosts: PathBuf,
) -> Result<Handle<HostKeyVerifier>, SshError> {
    let changed_line = Arc::new(Mutex::new(None));
    let verifier = HostKeyVerifier {
        host: config.host.clone(),
        port: config.port,
        app_known_hosts,
        changed_line: Arc::clone(&changed_line),
    };
    let ssh_config = Arc::new(client::Config {
        keepalive_interval: Some(KEEPALIVE_INTERVAL),
        ..client::Config::default()
    });
    let mut session = client::connect(ssh_config, (config.host.as_str(), config.port), verifier)
        .await
        .map_err(|source| {
            let changed = *changed_line
                .lock()
                .unwrap_or_else(std::sync::PoisonError::into_inner);
            match changed {
                Some(line) => SshError::HostKeyChanged {
                    host: config.host.clone(),
                    line,
                },
                None => SshError::Unreachable {
                    host: config.host.clone(),
                    port: config.port,
                    source,
                },
            }
        })?;

    let authenticated = match &config.auth {
        SshAuthMethod::Password => {
            let password = credentials
                .password
                .as_deref()
                .ok_or(SshError::MissingPassword)?;
            session
                .authenticate_password(&config.username, password)
                .await?
        }
        SshAuthMethod::PrivateKey { key_file } => {
            let key = load_key(key_file, credentials.key_passphrase.as_deref())?;
            let hash = session.best_supported_rsa_hash().await?.flatten();
            session
                .authenticate_publickey(
                    &config.username,
                    PrivateKeyWithHashAlg::new(Arc::new(key), hash),
                )
                .await?
        }
    };
    if !authenticated.success() {
        return Err(SshError::AuthFailed(config.username.clone()));
    }
    Ok(session)
}

fn load_key(path: &str, passphrase: Option<&str>) -> Result<russh::keys::PrivateKey, SshError> {
    load_secret_key(path, passphrase).map_err(|source| match source {
        russh::keys::Error::KeyIsEncrypted => SshError::KeyPassphrase,
        source if passphrase.is_some() && is_decryption_failure(&source) => SshError::KeyPassphrase,
        source => SshError::KeyFile {
            path: path.to_owned(),
            source,
        },
    })
}

fn is_decryption_failure(error: &russh::keys::Error) -> bool {
    let text = error.to_string().to_ascii_lowercase();
    text.contains("decrypt") || text.contains("passphrase")
}

async fn accept_loop(
    listener: TcpListener,
    session: Arc<Handle<HostKeyVerifier>>,
    target: (String, u16),
) {
    loop {
        match listener.accept().await {
            Ok((socket, peer)) => {
                tokio::spawn(forward(socket, peer, Arc::clone(&session), target.clone()));
            }
            Err(error) => {
                tracing::warn!(%error, "SSH tunnel stopped accepting connections");
                break;
            }
        }
    }
}

async fn forward(
    mut socket: TcpStream,
    peer: std::net::SocketAddr,
    session: Arc<Handle<HostKeyVerifier>>,
    (host, port): (String, u16),
) {
    let channel = session
        .channel_open_direct_tcpip(
            host,
            u32::from(port),
            peer.ip().to_string(),
            u32::from(peer.port()),
        )
        .await;
    match channel {
        Ok(channel) => {
            let mut stream = channel.into_stream();
            if let Err(error) = tokio::io::copy_bidirectional(&mut socket, &mut stream).await {
                tracing::debug!(%error, "SSH forwarded connection closed");
            }
        }
        Err(error) => tracing::warn!(%error, "SSH server refused to open a forwarding channel"),
    }
}
