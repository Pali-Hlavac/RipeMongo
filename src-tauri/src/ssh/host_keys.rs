//! Server host-key verification for SSH tunnels.
//!
//! Order: the user's `~/.ssh/known_hosts`, then RipeMongo's own known_hosts file. Unknown
//! hosts are trusted on first use and recorded in RipeMongo's file; a changed key is
//! always rejected.

use std::path::PathBuf;
use std::sync::{Arc, Mutex};

use russh::client;
use russh::keys::known_hosts::learn_known_hosts_path;
use russh::keys::{check_known_hosts, check_known_hosts_path, PublicKeyOrCertificate};

/// russh client handler that verifies the server key and remembers why it rejected one.
pub(super) struct HostKeyVerifier {
    pub host: String,
    pub port: u16,
    pub app_known_hosts: PathBuf,
    /// Set to the known_hosts line number when a recorded key does not match.
    pub changed_line: Arc<Mutex<Option<usize>>>,
}

impl HostKeyVerifier {
    fn verify(&self, key: &russh::keys::PublicKey) -> bool {
        let user_check = check_known_hosts(&self.host, self.port, key);
        let app_check =
            || check_known_hosts_path(&self.host, self.port, key, &self.app_known_hosts);
        let result = match user_check {
            Ok(true) => Ok(true),
            Ok(false) | Err(russh::keys::Error::NoHomeDir) => app_check(),
            Err(error) => Err(error),
        };
        match result {
            Ok(true) => true,
            Ok(false) => self.trust_on_first_use(key),
            Err(russh::keys::Error::KeyChanged { line }) => {
                self.record_changed(line);
                false
            }
            Err(error) => {
                tracing::warn!(%error, host = %self.host, "could not read known_hosts");
                false
            }
        }
    }

    fn trust_on_first_use(&self, key: &russh::keys::PublicKey) -> bool {
        if let Some(parent) = self.app_known_hosts.parent() {
            // A failure here surfaces when learning the key below.
            let _ = std::fs::create_dir_all(parent);
        }
        match learn_known_hosts_path(&self.host, self.port, key, &self.app_known_hosts) {
            Ok(()) => {
                tracing::info!(host = %self.host, port = self.port, "trusting new SSH host key");
                true
            }
            Err(error) => {
                tracing::warn!(%error, "could not record SSH host key");
                false
            }
        }
    }

    fn record_changed(&self, line: usize) {
        let mut slot = self
            .changed_line
            .lock()
            .unwrap_or_else(std::sync::PoisonError::into_inner);
        *slot = Some(line);
    }
}

impl client::Handler for HostKeyVerifier {
    type Error = russh::Error;

    async fn check_server_key(
        &mut self,
        server_key: &PublicKeyOrCertificate,
    ) -> Result<bool, Self::Error> {
        Ok(match server_key {
            PublicKeyOrCertificate::PublicKey { key, .. } => self.verify(key),
            PublicKeyOrCertificate::Certificate(_) => {
                tracing::warn!(host = %self.host, "SSH host certificates are not supported");
                false
            }
        })
    }
}
