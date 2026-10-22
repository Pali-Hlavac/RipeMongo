//! Parsers for individual option values (booleans, enums, property lists).

use super::options::{key, property};
use super::UriError;
use crate::connections::{OidcEnvironment, ReadPreferenceMode};

pub(super) fn parse_properties(value: &str) -> Result<Vec<(String, String)>, UriError> {
    value
        .split(',')
        .filter(|pair| !pair.is_empty())
        .map(|pair| {
            pair.split_once(':')
                .map(|(k, v)| (k.to_owned(), v.to_owned()))
                .ok_or_else(|| UriError::InvalidValue {
                    key: key::AUTH_PROPERTIES.into(),
                    value: value.into(),
                })
        })
        .collect()
}

pub(super) fn parse_bool(name: &str, value: &str) -> Result<bool, UriError> {
    match value.to_ascii_lowercase().as_str() {
        "true" => Ok(true),
        "false" => Ok(false),
        _ => Err(invalid(name, value)),
    }
}

pub(super) fn parse_read_preference(
    name: &str,
    value: &str,
) -> Result<ReadPreferenceMode, UriError> {
    Ok(match value.to_ascii_lowercase().as_str() {
        "primary" => ReadPreferenceMode::Primary,
        "primarypreferred" => ReadPreferenceMode::PrimaryPreferred,
        "secondary" => ReadPreferenceMode::Secondary,
        "secondarypreferred" => ReadPreferenceMode::SecondaryPreferred,
        "nearest" => ReadPreferenceMode::Nearest,
        _ => return Err(invalid(name, value)),
    })
}

pub(super) fn parse_oidc_environment(value: &str) -> Result<OidcEnvironment, UriError> {
    Ok(match value.to_ascii_lowercase().as_str() {
        "azure" => OidcEnvironment::Azure,
        "gcp" => OidcEnvironment::Gcp,
        "k8s" => OidcEnvironment::K8s,
        _ => return Err(invalid(property::ENVIRONMENT, value)),
    })
}

fn invalid(name: &str, value: &str) -> UriError {
    UriError::InvalidValue {
        key: name.to_owned(),
        value: value.to_owned(),
    }
}
