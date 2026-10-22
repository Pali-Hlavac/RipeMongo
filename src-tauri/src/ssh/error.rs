//! SSH tunnel errors and their user-facing mapping.

use crate::error::{AppError, ErrorCode};

/// Failure modes of [`SshTunnel::open`](super::SshTunnel::open).
#[derive(Debug, thiserror::Error)]
pub enum SshError {
    #[error("could not reach SSH server {host}:{port}: {source}")]
    Unreachable {
        host: String,
        port: u16,
        #[source]
        source: russh::Error,
    },
    #[error("SSH connection timed out")]
    Timeout,
    #[error("SSH host key for {host} changed (known_hosts line {line})")]
    HostKeyChanged { host: String, line: usize },
    #[error("SSH authentication failed for user {0}")]
    AuthFailed(String),
    #[error("SSH password is missing")]
    MissingPassword,
    #[error("could not read private key {path}: {source}")]
    KeyFile {
        path: String,
        #[source]
        source: russh::keys::Error,
    },
    #[error("private key is encrypted and the passphrase is missing or wrong")]
    KeyPassphrase,
    #[error("could not open local tunnel port: {0}")]
    LocalPort(#[source] std::io::Error),
    #[error("SSH protocol error: {0}")]
    Protocol(#[from] russh::Error),
}

impl From<SshError> for AppError {
    fn from(error: SshError) -> Self {
        tracing::warn!(%error, "SSH tunnel failed");
        let (message, hint) = match &error {
            SshError::Unreachable { host, port, .. } => (
                format!("Could not reach the SSH server {host}:{port}."),
                "Check the SSH host, port and your network or VPN.",
            ),
            SshError::Timeout => (
                "Connecting to the SSH server timed out.".to_owned(),
                "Check the SSH host and port, and that a firewall is not blocking it.",
            ),
            SshError::HostKeyChanged { host, .. } => (
                format!("The SSH host key of {host} has changed. This could be a man-in-the-middle attack."),
                "If the server was legitimately reinstalled, remove its entry from known_hosts and try again.",
            ),
            SshError::AuthFailed(user) => (
                format!("The SSH server rejected user \"{user}\"."),
                "Check the SSH user name, password or private key.",
            ),
            SshError::MissingPassword => (
                "No SSH password is saved for this connection.".to_owned(),
                "Edit the connection and enter the SSH password.",
            ),
            SshError::KeyFile { path, .. } => (
                format!("Could not read the private key file {path}."),
                "Check the path and that the file is an OpenSSH, PEM or PKCS#8 private key.",
            ),
            SshError::KeyPassphrase => (
                "The private key is encrypted and the passphrase is missing or wrong.".to_owned(),
                "Edit the connection and enter the key passphrase.",
            ),
            SshError::LocalPort(_) => (
                "Could not open a local port for the SSH tunnel.".to_owned(),
                "Another program may be blocking local ports; try again.",
            ),
            SshError::Protocol(_) => (
                "The SSH connection failed.".to_owned(),
                "Check that the server allows TCP forwarding (AllowTcpForwarding yes).",
            ),
        };
        AppError::new(ErrorCode::SshFailed, message).with_hint(hint)
    }
}
