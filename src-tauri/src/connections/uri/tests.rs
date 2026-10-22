//! Unit tests for connection-string parsing, building and redaction.

use super::*;
use crate::connections::{
    AuthConfig, ConnectionConfig, HostPort, OidcEnvironment, ReadPreferenceMode, Scheme,
    ScramVariant, TlsConfig, UriOption,
};

fn parse(uri: &str) -> ParsedConnectionString {
    parse_connection_string(uri).unwrap()
}

fn host(name: &str, port: Option<u16>) -> HostPort {
    HostPort {
        host: name.into(),
        port,
    }
}

#[test]
fn parses_plain_local_uri() {
    let parsed = parse("mongodb://localhost:27017");
    assert_eq!(parsed.config.scheme, Scheme::Standard);
    assert_eq!(parsed.config.hosts, vec![host("localhost", Some(27017))]);
    assert_eq!(parsed.config.auth, AuthConfig::None);
}

#[test]
fn parses_replica_set_with_scram_and_options() {
    let parsed = parse(
        "mongodb://ad%40min:p%3Ass@h1:27017,h2,[::1]:27018/app?authSource=admin&replicaSet=rs0&readPreference=secondaryPreferred&appName=x&retryWrites=false",
    );
    let config = &parsed.config;
    assert_eq!(
        config.hosts,
        vec![
            host("h1", Some(27017)),
            host("h2", None),
            host("::1", Some(27018))
        ]
    );
    assert_eq!(
        config.auth,
        AuthConfig::Scram {
            username: "ad@min".into(),
            auth_source: Some("admin".into()),
            variant: ScramVariant::Auto,
        }
    );
    assert_eq!(parsed.secrets.password.as_deref(), Some("p:ss"));
    assert_eq!(config.default_database.as_deref(), Some("app"));
    assert_eq!(config.replica_set.as_deref(), Some("rs0"));
    assert_eq!(
        config.read_preference,
        Some(ReadPreferenceMode::SecondaryPreferred)
    );
    assert_eq!(
        config.extra_options,
        vec![UriOption {
            key: "retryWrites".into(),
            value: "false".into()
        }]
    );
}

#[test]
fn parses_srv_with_tls_files_and_insecure() {
    let parsed = parse(
        "mongodb+srv://cluster0.example.net/?tls=true&tlsCAFile=C:\\certs\\ca.pem&tlsCertificateKeyFile=/k.pem&tlsCertificateKeyFilePassword=secret&tlsInsecure=true",
    );
    assert_eq!(parsed.config.scheme, Scheme::Srv);
    assert_eq!(
        parsed.config.tls,
        TlsConfig {
            enabled: Some(true),
            ca_file: Some("C:\\certs\\ca.pem".into()),
            certificate_key_file: Some("/k.pem".into()),
            allow_invalid_certificates: true,
            allow_invalid_hostnames: true,
        }
    );
    assert_eq!(parsed.secrets.tls_key_password.as_deref(), Some("secret"));
}

#[test]
fn parses_special_mechanisms() {
    let x509 = parse("mongodb://h/?authMechanism=MONGODB-X509&tls=true");
    assert_eq!(x509.config.auth, AuthConfig::X509 { username: None });

    let ldap = parse("mongodb://u:p@h/?authMechanism=PLAIN&authSource=$external");
    assert_eq!(
        ldap.config.auth,
        AuthConfig::Ldap {
            username: "u".into()
        }
    );

    let aws = parse("mongodb://KEY:SECRET@h/?authMechanism=MONGODB-AWS&authMechanismProperties=AWS_SESSION_TOKEN:tok");
    assert_eq!(
        aws.config.auth,
        AuthConfig::Aws {
            access_key_id: Some("KEY".into())
        }
    );
    assert_eq!(aws.secrets.password.as_deref(), Some("SECRET"));
    assert_eq!(aws.secrets.aws_session_token.as_deref(), Some("tok"));

    let oidc = parse("mongodb://h/?authMechanism=MONGODB-OIDC&authMechanismProperties=ENVIRONMENT:azure,TOKEN_RESOURCE:api://x");
    assert_eq!(
        oidc.config.auth,
        AuthConfig::Oidc {
            username: None,
            environment: Some(OidcEnvironment::Azure),
            token_resource: Some("api://x".into()),
        }
    );
}

#[test]
fn rejects_invalid_input() {
    let cases = [
        ("localhost:27017", UriError::MissingScheme),
        ("mongodb://", UriError::MissingHost),
        ("mongodb://h:99999", UriError::InvalidPort("99999".into())),
        ("mongodb+srv://a,b", UriError::InvalidSrvHost),
        ("mongodb+srv://a:27017", UriError::InvalidSrvHost),
        (
            "mongodb://h/?tls=maybe",
            UriError::InvalidValue {
                key: "tls".into(),
                value: "maybe".into(),
            },
        ),
        ("mongodb://h/?tls", UriError::MissingValue("tls".into())),
        ("mongodb://u%zz@h", UriError::InvalidEncoding("u%zz".into())),
    ];
    for (uri, expected) in cases {
        assert_eq!(parse_connection_string(uri), Err(expected), "{uri}");
    }
    assert!(matches!(
        parse_connection_string("mongodb://h/?authMechanism=GSSAPI"),
        Err(UriError::Unsupported(_))
    ));
    assert!(matches!(
        parse_connection_string("mongodb://h/?authMechanism=SCRAM-SHA-256"),
        Err(UriError::Invalid(_))
    ));
}

#[test]
fn builds_without_password_unless_secrets_are_given() {
    let parsed = parse("mongodb://user:pa%20ss@h1,h2:27018/db?authSource=admin&authMechanism=SCRAM-SHA-256&tls=true");
    let display = build_connection_string(&parsed.config, None);
    assert_eq!(
        display,
        "mongodb://user@h1,h2:27018/db?authSource=admin&authMechanism=SCRAM-SHA-256&tls=true"
    );
    let connect = build_connection_string(&parsed.config, Some(&parsed.secrets));
    assert!(connect.starts_with("mongodb://user:pa%20ss@h1"));
}

#[test]
fn round_trips_every_field() {
    let config = ConnectionConfig {
        scheme: Scheme::Standard,
        hosts: vec![host("a.example", Some(27017)), host("::1", None)],
        auth: AuthConfig::Oidc {
            username: Some("client".into()),
            environment: Some(OidcEnvironment::Gcp),
            token_resource: Some("aud".into()),
        },
        tls: TlsConfig {
            enabled: Some(true),
            ca_file: Some("/etc/ssl/ca & more.pem".into()),
            certificate_key_file: None,
            allow_invalid_certificates: true,
            allow_invalid_hostnames: false,
        },
        replica_set: Some("rs0".into()),
        read_preference: Some(ReadPreferenceMode::Nearest),
        direct_connection: Some(false),
        app_name: Some("Ripe Mongo".into()),
        default_database: Some("my/db".into()),
        extra_options: vec![UriOption {
            key: "w".into(),
            value: "majority".into(),
        }],
        ssh: None,
    };
    let uri = build_connection_string(&config, None);
    assert_eq!(parse(&uri).config, config, "{uri}");
}

#[test]
fn ldap_round_trip_does_not_leak_auth_source_into_extras() {
    let config = parse("mongodb://u@h/?authMechanism=PLAIN").config;
    let uri = build_connection_string(&config, None);
    assert_eq!(parse(&uri).config, config);
    assert!(config.extra_options.is_empty());
}

#[test]
fn redacts_passwords_in_text() {
    let text = "failed for mongodb://admin:hunter2@db:27017/?x=1 and mongodb+srv://u:p@c.net";
    assert_eq!(
        redact_uri(text),
        "failed for mongodb://admin:****@db:27017/?x=1 and mongodb+srv://u:****@c.net"
    );
    assert_eq!(redact_uri("mongodb://user@h"), "mongodb://user@h");
    assert_eq!(redact_uri("no uri here"), "no uri here");
}
