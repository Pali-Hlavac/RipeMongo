//! Interprets raw URI options and credentials as a [`ConnectionConfig`] plus secrets.

use super::parse::RawUri;
use super::values::{parse_bool, parse_oidc_environment, parse_properties, parse_read_preference};
use super::UriError;
use crate::connections::{
    AuthConfig, ConnectionConfig, ConnectionSecrets, ScramVariant, TlsConfig, UriOption,
};

/// Canonical option names, as emitted by the builder.
pub(super) mod key {
    pub const AUTH_SOURCE: &str = "authSource";
    pub const AUTH_MECHANISM: &str = "authMechanism";
    pub const AUTH_PROPERTIES: &str = "authMechanismProperties";
    pub const TLS: &str = "tls";
    pub const TLS_CA_FILE: &str = "tlsCAFile";
    pub const TLS_CERT_KEY_FILE: &str = "tlsCertificateKeyFile";
    pub const TLS_CERT_KEY_PASSWORD: &str = "tlsCertificateKeyFilePassword";
    pub const TLS_ALLOW_INVALID_CERTS: &str = "tlsAllowInvalidCertificates";
    pub const TLS_ALLOW_INVALID_HOSTNAMES: &str = "tlsAllowInvalidHostnames";
    pub const REPLICA_SET: &str = "replicaSet";
    pub const READ_PREFERENCE: &str = "readPreference";
    pub const DIRECT_CONNECTION: &str = "directConnection";
    pub const APP_NAME: &str = "appName";
}

/// Auth mechanism names in URIs.
pub(super) mod mechanism {
    pub const SCRAM_SHA_1: &str = "SCRAM-SHA-1";
    pub const SCRAM_SHA_256: &str = "SCRAM-SHA-256";
    pub const X509: &str = "MONGODB-X509";
    pub const PLAIN: &str = "PLAIN";
    pub const AWS: &str = "MONGODB-AWS";
    pub const OIDC: &str = "MONGODB-OIDC";
}

/// `authMechanismProperties` keys.
pub(super) mod property {
    pub const AWS_SESSION_TOKEN: &str = "AWS_SESSION_TOKEN";
    pub const ENVIRONMENT: &str = "ENVIRONMENT";
    pub const TOKEN_RESOURCE: &str = "TOKEN_RESOURCE";
}

/// Options with dedicated fields, collected before resolving auth.
#[derive(Default)]
struct Known {
    auth_source: Option<String>,
    mechanism: Option<String>,
    properties: Vec<(String, String)>,
}

pub(super) fn into_config(raw: RawUri) -> Result<(ConnectionConfig, ConnectionSecrets), UriError> {
    let mut config = ConnectionConfig {
        scheme: raw.scheme,
        hosts: raw.hosts,
        default_database: raw.database,
        tls: TlsConfig::default(),
        ..ConnectionConfig::default()
    };
    let mut secrets = ConnectionSecrets::default();
    let mut known = Known::default();

    for (name, value) in raw.options {
        apply_option(&mut config, &mut secrets, &mut known, name, value)?;
    }
    config.auth = resolve_auth(raw.username, raw.password, known, &mut secrets, &mut config)?;
    Ok((config, secrets))
}

fn apply_option(
    config: &mut ConnectionConfig,
    secrets: &mut ConnectionSecrets,
    known: &mut Known,
    name: String,
    value: String,
) -> Result<(), UriError> {
    let tls = &mut config.tls;
    match name.to_ascii_lowercase().as_str() {
        "authsource" => known.auth_source = Some(value),
        "authmechanism" => known.mechanism = Some(value.to_ascii_uppercase()),
        "authmechanismproperties" => known.properties = parse_properties(&value)?,
        "tls" | "ssl" => tls.enabled = Some(parse_bool(&name, &value)?),
        "tlscafile" => tls.ca_file = Some(value),
        "tlscertificatekeyfile" => tls.certificate_key_file = Some(value),
        "tlscertificatekeyfilepassword" => secrets.tls_key_password = Some(value),
        "tlsallowinvalidcertificates" => {
            tls.allow_invalid_certificates = parse_bool(&name, &value)?
        }
        "tlsallowinvalidhostnames" => tls.allow_invalid_hostnames = parse_bool(&name, &value)?,
        "tlsinsecure" => {
            let insecure = parse_bool(&name, &value)?;
            tls.allow_invalid_certificates = insecure;
            tls.allow_invalid_hostnames = insecure;
        }
        "replicaset" => config.replica_set = Some(value),
        "readpreference" => config.read_preference = Some(parse_read_preference(&name, &value)?),
        "directconnection" => config.direct_connection = Some(parse_bool(&name, &value)?),
        "appname" => config.app_name = Some(value),
        _ => config.extra_options.push(UriOption { key: name, value }),
    }
    Ok(())
}

fn resolve_auth(
    username: Option<String>,
    password: Option<String>,
    known: Known,
    secrets: &mut ConnectionSecrets,
    config: &mut ConnectionConfig,
) -> Result<AuthConfig, UriError> {
    let Known {
        auth_source,
        mechanism,
        properties,
    } = known;
    secrets.password = password;
    let require_user = |name: &str| {
        username
            .clone()
            .ok_or_else(|| UriError::Invalid(format!("{name} requires a user name.")))
    };
    let auth = match mechanism.as_deref() {
        None if username.is_none() => {
            if let Some(source) = auth_source {
                config.extra_options.push(UriOption {
                    key: key::AUTH_SOURCE.into(),
                    value: source,
                });
            }
            AuthConfig::None
        }
        None => scram(
            require_user("Password authentication")?,
            auth_source,
            ScramVariant::Auto,
        ),
        Some(mechanism::SCRAM_SHA_1) => scram(
            require_user("SCRAM-SHA-1")?,
            auth_source,
            ScramVariant::Sha1,
        ),
        Some(mechanism::SCRAM_SHA_256) => scram(
            require_user("SCRAM-SHA-256")?,
            auth_source,
            ScramVariant::Sha256,
        ),
        Some(mechanism::X509) => AuthConfig::X509 { username },
        Some(mechanism::PLAIN) => AuthConfig::Ldap {
            username: require_user("LDAP (PLAIN)")?,
        },
        Some(mechanism::AWS) => {
            let mut props = Properties(properties);
            secrets.aws_session_token = props.take(property::AWS_SESSION_TOKEN);
            props.ensure_empty()?;
            AuthConfig::Aws {
                access_key_id: username,
            }
        }
        Some(mechanism::OIDC) => {
            let mut props = Properties(properties);
            let environment = props
                .take(property::ENVIRONMENT)
                .map(|value| parse_oidc_environment(&value))
                .transpose()?;
            let token_resource = props.take(property::TOKEN_RESOURCE);
            props.ensure_empty()?;
            AuthConfig::Oidc {
                username,
                environment,
                token_resource,
            }
        }
        Some(other) => return Err(UriError::Unsupported(format!("The {other} auth mechanism"))),
    };
    Ok(auth)
}

fn scram(username: String, auth_source: Option<String>, variant: ScramVariant) -> AuthConfig {
    AuthConfig::Scram {
        username,
        auth_source,
        variant,
    }
}

/// Remaining `authMechanismProperties`; anything unconsumed is unsupported.
struct Properties(Vec<(String, String)>);

impl Properties {
    fn take(&mut self, name: &str) -> Option<String> {
        let index = self
            .0
            .iter()
            .position(|(key, _)| key.eq_ignore_ascii_case(name))?;
        Some(self.0.remove(index).1)
    }

    fn ensure_empty(&self) -> Result<(), UriError> {
        match self.0.first() {
            None => Ok(()),
            Some((name, _)) => Err(UriError::Unsupported(format!(
                "The auth mechanism property \"{name}\""
            ))),
        }
    }
}
