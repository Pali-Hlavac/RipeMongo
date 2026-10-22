//! Builds a connection string from a [`ConnectionConfig`]. Without secrets the result is
//! safe to display; with secrets it is only used in memory to connect.

use super::encode::{encode_path_segment, encode_query_value, encode_userinfo};
use super::options::{key, mechanism, property};
use crate::connections::{
    AuthConfig, ConnectionConfig, ConnectionSecrets, OidcEnvironment, ReadPreferenceMode, Scheme,
    ScramVariant,
};

/// Renders `config` as a URI. Pass `secrets` only when the URI is used to connect.
pub fn build_connection_string(
    config: &ConnectionConfig,
    secrets: Option<&ConnectionSecrets>,
) -> String {
    let scheme = match config.scheme {
        Scheme::Standard => "mongodb://",
        Scheme::Srv => "mongodb+srv://",
    };
    let mut uri = String::from(scheme);
    uri.push_str(&userinfo(&config.auth, secrets));
    uri.push_str(&hosts(config));
    uri.push('/');
    if let Some(database) = &config.default_database {
        uri.push_str(&encode_path_segment(database));
    }
    let query = query_options(config, secrets)
        .iter()
        .map(|(name, value)| format!("{name}={}", encode_query_value(value)))
        .collect::<Vec<_>>()
        .join("&");
    if !query.is_empty() {
        uri.push('?');
        uri.push_str(&query);
    }
    uri
}

fn userinfo(auth: &AuthConfig, secrets: Option<&ConnectionSecrets>) -> String {
    let user = match auth {
        AuthConfig::None => None,
        AuthConfig::Scram { username, .. } | AuthConfig::Ldap { username } => Some(username),
        AuthConfig::X509 { username } | AuthConfig::Oidc { username, .. } => username.as_ref(),
        AuthConfig::Aws { access_key_id } => access_key_id.as_ref(),
    };
    let Some(user) = user.filter(|user| !user.is_empty()) else {
        return String::new();
    };
    let password = secrets.and_then(|s| s.password.as_deref()).filter(|_| {
        matches!(
            auth,
            AuthConfig::Scram { .. } | AuthConfig::Ldap { .. } | AuthConfig::Aws { .. }
        )
    });
    match password {
        Some(password) => format!("{}:{}@", encode_userinfo(user), encode_userinfo(password)),
        None => format!("{}@", encode_userinfo(user)),
    }
}

fn hosts(config: &ConnectionConfig) -> String {
    config
        .hosts
        .iter()
        .map(|entry| {
            let host = if entry.host.contains(':') {
                format!("[{}]", entry.host)
            } else {
                encode_path_segment(&entry.host)
            };
            match entry.port {
                Some(port) => format!("{host}:{port}"),
                None => host,
            }
        })
        .collect::<Vec<_>>()
        .join(",")
}

fn query_options(
    config: &ConnectionConfig,
    secrets: Option<&ConnectionSecrets>,
) -> Vec<(String, String)> {
    let mut options = Vec::new();
    let mut push = |name: &str, value: String| options.push((name.to_owned(), value));

    push_auth_options(&config.auth, secrets, &mut push);
    let tls = &config.tls;
    if let Some(enabled) = tls.enabled {
        push(key::TLS, enabled.to_string());
    }
    if let Some(ca_file) = &tls.ca_file {
        push(key::TLS_CA_FILE, ca_file.clone());
    }
    if let Some(cert) = &tls.certificate_key_file {
        push(key::TLS_CERT_KEY_FILE, cert.clone());
    }
    if let Some(password) = secrets.and_then(|s| s.tls_key_password.clone()) {
        push(key::TLS_CERT_KEY_PASSWORD, password);
    }
    if tls.allow_invalid_certificates {
        push(key::TLS_ALLOW_INVALID_CERTS, true.to_string());
    }
    if tls.allow_invalid_hostnames {
        push(key::TLS_ALLOW_INVALID_HOSTNAMES, true.to_string());
    }
    if let Some(replica_set) = &config.replica_set {
        push(key::REPLICA_SET, replica_set.clone());
    }
    if let Some(mode) = config.read_preference {
        push(key::READ_PREFERENCE, read_preference_name(mode).to_owned());
    }
    if let Some(direct) = config.direct_connection {
        push(key::DIRECT_CONNECTION, direct.to_string());
    }
    if let Some(app_name) = &config.app_name {
        push(key::APP_NAME, app_name.clone());
    }
    for option in &config.extra_options {
        push(&option.key, option.value.clone());
    }
    options
}

fn push_auth_options(
    auth: &AuthConfig,
    secrets: Option<&ConnectionSecrets>,
    push: &mut impl FnMut(&str, String),
) {
    match auth {
        AuthConfig::None => {}
        AuthConfig::Scram {
            auth_source,
            variant,
            ..
        } => {
            if let Some(source) = auth_source {
                push(key::AUTH_SOURCE, source.clone());
            }
            match variant {
                ScramVariant::Auto => {}
                ScramVariant::Sha1 => push(key::AUTH_MECHANISM, mechanism::SCRAM_SHA_1.into()),
                ScramVariant::Sha256 => push(key::AUTH_MECHANISM, mechanism::SCRAM_SHA_256.into()),
            }
        }
        AuthConfig::X509 { .. } => push(key::AUTH_MECHANISM, mechanism::X509.into()),
        AuthConfig::Ldap { .. } => {
            push(key::AUTH_SOURCE, "$external".into());
            push(key::AUTH_MECHANISM, mechanism::PLAIN.into());
        }
        AuthConfig::Aws { .. } => {
            push(key::AUTH_MECHANISM, mechanism::AWS.into());
            if let Some(token) = secrets.and_then(|s| s.aws_session_token.as_ref()) {
                push(
                    key::AUTH_PROPERTIES,
                    format!("{}:{token}", property::AWS_SESSION_TOKEN),
                );
            }
        }
        AuthConfig::Oidc {
            environment,
            token_resource,
            ..
        } => {
            push(key::AUTH_MECHANISM, mechanism::OIDC.into());
            let mut properties = Vec::new();
            if let Some(environment) = environment {
                properties.push(format!(
                    "{}:{}",
                    property::ENVIRONMENT,
                    oidc_name(*environment)
                ));
            }
            if let Some(resource) = token_resource {
                properties.push(format!("{}:{resource}", property::TOKEN_RESOURCE));
            }
            if !properties.is_empty() {
                push(key::AUTH_PROPERTIES, properties.join(","));
            }
        }
    }
}

fn read_preference_name(mode: ReadPreferenceMode) -> &'static str {
    match mode {
        ReadPreferenceMode::Primary => "primary",
        ReadPreferenceMode::PrimaryPreferred => "primaryPreferred",
        ReadPreferenceMode::Secondary => "secondary",
        ReadPreferenceMode::SecondaryPreferred => "secondaryPreferred",
        ReadPreferenceMode::Nearest => "nearest",
    }
}

fn oidc_name(environment: OidcEnvironment) -> &'static str {
    match environment {
        OidcEnvironment::Azure => "azure",
        OidcEnvironment::Gcp => "gcp",
        OidcEnvironment::K8s => "k8s",
    }
}
