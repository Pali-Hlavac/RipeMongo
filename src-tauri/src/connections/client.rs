//! Builds `mongodb::Client`s from a config + secrets, optionally through an SSH tunnel.

use std::path::Path;
use std::time::Duration;

use mongodb::options::ClientOptions;
use mongodb::Client;

use super::uri::build_connection_string;
use super::{ConnectionConfig, ConnectionError, ConnectionSecrets, HostPort, DEFAULT_PORT};
use crate::ssh::{SshCredentials, SshTunnel};

/// Server selection timeout when the user did not set `serverSelectionTimeoutMS`.
const DEFAULT_SERVER_SELECTION_TIMEOUT: Duration = Duration::from_secs(10);
/// Socket connect timeout when the user did not set `connectTimeoutMS`.
const DEFAULT_CONNECT_TIMEOUT: Duration = Duration::from_secs(10);
/// `appName` reported to the server when the user did not set one.
const DEFAULT_APP_NAME: &str = "RipeMongo";

/// A client plus the tunnel that must stay alive as long as the client is used.
pub struct OpenedClient {
    pub client: Client,
    pub tunnel: Option<SshTunnel>,
}

/// Opens the SSH tunnel (if configured) and creates a driver client. Does not contact
/// MongoDB yet; the first operation does.
pub async fn open_client(
    config: &ConnectionConfig,
    secrets: &ConnectionSecrets,
    app_known_hosts: &Path,
) -> Result<OpenedClient, ConnectionError> {
    let (effective, tunnel) = match &config.ssh {
        Some(ssh) => {
            let target = config
                .hosts
                .first()
                .ok_or_else(|| ConnectionError::Invalid("Enter at least one host.".into()))?;
            let credentials = SshCredentials {
                password: secrets.ssh_password.clone(),
                key_passphrase: secrets.ssh_key_passphrase.clone(),
            };
            let tunnel = SshTunnel::open(
                ssh,
                &credentials,
                &target.host,
                target.port.unwrap_or(DEFAULT_PORT),
                app_known_hosts.to_path_buf(),
            )
            .await?;
            (through_tunnel(config, tunnel.local_port()), Some(tunnel))
        }
        None => (config.clone(), None),
    };

    let uri = build_connection_string(&effective, Some(secrets));
    let mut options = ClientOptions::parse(&uri).await?;
    options.server_selection_timeout = options
        .server_selection_timeout
        .or(Some(DEFAULT_SERVER_SELECTION_TIMEOUT));
    options.connect_timeout = options.connect_timeout.or(Some(DEFAULT_CONNECT_TIMEOUT));
    options.app_name = options
        .app_name
        .or_else(|| Some(DEFAULT_APP_NAME.to_owned()));
    let client = Client::with_options(options)?;
    Ok(OpenedClient { client, tunnel })
}

/// Rewrites the config so the driver talks to the local tunnel endpoint. The tunnel reaches
/// exactly one member, so the connection is forced to be direct. With TLS, the certificate
/// is issued for the real host name, not 127.0.0.1, so host-name checks are relaxed
/// (the certificate chain is still verified). See ADR 0013.
fn through_tunnel(config: &ConnectionConfig, local_port: u16) -> ConnectionConfig {
    let mut effective = config.clone();
    effective.hosts = vec![HostPort {
        host: crate::ssh::LOOPBACK.to_owned(),
        port: Some(local_port),
    }];
    effective.direct_connection = Some(true);
    effective.ssh = None;
    if effective.tls.enabled == Some(true) {
        effective.tls.allow_invalid_hostnames = true;
    }
    effective
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn tunnel_rewrite_targets_loopback_directly() {
        let config = ConnectionConfig {
            replica_set: Some("rs0".into()),
            tls: crate::connections::TlsConfig {
                enabled: Some(true),
                ..Default::default()
            },
            ..ConnectionConfig::default()
        };
        let effective = through_tunnel(&config, 40_000);
        assert_eq!(effective.hosts[0].host, "127.0.0.1");
        assert_eq!(effective.hosts[0].port, Some(40_000));
        assert_eq!(effective.direct_connection, Some(true));
        assert!(effective.tls.allow_invalid_hostnames);
        assert_eq!(effective.replica_set.as_deref(), Some("rs0"));
    }
}
