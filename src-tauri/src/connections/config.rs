//! Structured connection settings: everything a connection string can express, plus the
//! SSH tunnel (which a URI cannot). Secrets are never part of these types.

use serde::{Deserialize, Serialize};
use specta::Type;

/// `mongodb://` or `mongodb+srv://`.
#[derive(Debug, Clone, Copy, Default, PartialEq, Eq, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub enum Scheme {
    #[default]
    Standard,
    Srv,
}

/// One seed host. `port` is `None` for SRV records or when the default port is meant.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct HostPort {
    pub host: String,
    pub port: Option<u16>,
}

/// SCRAM flavour; `Auto` lets the server negotiate.
#[derive(Debug, Clone, Copy, Default, PartialEq, Eq, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub enum ScramVariant {
    #[default]
    Auto,
    Sha1,
    Sha256,
}

/// Built-in OIDC machine-workflow providers supported by the driver.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub enum OidcEnvironment {
    Azure,
    Gcp,
    K8s,
}

/// Authentication mechanism and its non-secret parameters.
#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize, Deserialize, Type)]
#[serde(
    tag = "mechanism",
    rename_all = "camelCase",
    rename_all_fields = "camelCase"
)]
pub enum AuthConfig {
    #[default]
    None,
    /// Username/password (SCRAM-SHA-1/256). Password lives in the keychain.
    Scram {
        username: String,
        auth_source: Option<String>,
        variant: ScramVariant,
    },
    /// Client-certificate authentication (requires TLS with a client certificate).
    X509 { username: Option<String> },
    /// LDAP proxy authentication (`PLAIN`, `authSource=$external`).
    Ldap { username: String },
    /// AWS IAM. Without an access key id the driver uses environment/instance credentials.
    Aws { access_key_id: Option<String> },
    /// OIDC machine workflow via a cloud environment provider.
    Oidc {
        username: Option<String>,
        environment: Option<OidcEnvironment>,
        token_resource: Option<String>,
    },
}

/// TLS settings. `enabled: None` keeps the driver default (on for SRV, off otherwise).
#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct TlsConfig {
    pub enabled: Option<bool>,
    pub ca_file: Option<String>,
    pub certificate_key_file: Option<String>,
    pub allow_invalid_certificates: bool,
    pub allow_invalid_hostnames: bool,
}

/// Read preference modes.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub enum ReadPreferenceMode {
    Primary,
    PrimaryPreferred,
    Secondary,
    SecondaryPreferred,
    Nearest,
}

/// A URI option RipeMongo has no dedicated field for; preserved verbatim and in order.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct UriOption {
    pub key: String,
    pub value: String,
}

/// How to authenticate against the SSH server. Secrets live in the keychain.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, Type)]
#[serde(
    tag = "method",
    rename_all = "camelCase",
    rename_all_fields = "camelCase"
)]
pub enum SshAuthMethod {
    Password,
    PrivateKey { key_file: String },
}

/// SSH tunnel through a bastion host. Only single-host, non-SRV targets are supported.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct SshConfig {
    pub host: String,
    pub port: u16,
    pub username: String,
    pub auth: SshAuthMethod,
}

/// Everything needed to reach a deployment, minus secrets.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct ConnectionConfig {
    pub scheme: Scheme,
    pub hosts: Vec<HostPort>,
    pub auth: AuthConfig,
    pub tls: TlsConfig,
    pub replica_set: Option<String>,
    pub read_preference: Option<ReadPreferenceMode>,
    pub direct_connection: Option<bool>,
    pub app_name: Option<String>,
    /// Database in the URI path; also the default auth database for SCRAM.
    pub default_database: Option<String>,
    pub extra_options: Vec<UriOption>,
    pub ssh: Option<SshConfig>,
}

/// Default MongoDB port.
pub const DEFAULT_PORT: u16 = 27017;

/// Default SSH port.
pub const DEFAULT_SSH_PORT: u16 = 22;

impl Default for ConnectionConfig {
    /// A local standalone server without auth: `mongodb://localhost:27017`.
    fn default() -> Self {
        Self {
            scheme: Scheme::Standard,
            hosts: vec![HostPort {
                host: "localhost".into(),
                port: Some(DEFAULT_PORT),
            }],
            auth: AuthConfig::None,
            tls: TlsConfig::default(),
            replica_set: None,
            read_preference: None,
            direct_connection: None,
            app_name: None,
            default_database: None,
            extra_options: Vec::new(),
            ssh: None,
        }
    }
}
