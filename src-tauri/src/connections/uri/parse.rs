//! Structural split of a connection string into scheme, credentials, hosts, database and
//! raw options. Option semantics are handled in `options.rs`.

use super::encode::decode;
use super::UriError;
use crate::connections::{HostPort, Scheme};

const STANDARD_PREFIX: &str = "mongodb://";
const SRV_PREFIX: &str = "mongodb+srv://";

/// Connection string pieces after percent-decoding.
#[derive(Debug, Default)]
pub(super) struct RawUri {
    pub scheme: Scheme,
    pub username: Option<String>,
    pub password: Option<String>,
    pub hosts: Vec<HostPort>,
    pub database: Option<String>,
    pub options: Vec<(String, String)>,
}

pub(super) fn split(uri: &str) -> Result<RawUri, UriError> {
    let (scheme, rest) = strip_scheme(uri.trim())?;
    let authority_end = rest.find(['/', '?']).unwrap_or(rest.len());
    let (authority, tail) = rest.split_at(authority_end);

    let (userinfo, host_list) = match authority.rfind('@') {
        Some(at) => (Some(&authority[..at]), &authority[at + 1..]),
        None => (None, authority),
    };
    let (username, password) = match userinfo {
        Some(info) => split_userinfo(info)?,
        None => (None, None),
    };
    let hosts = parse_hosts(host_list, scheme)?;
    let (database, query) = split_tail(tail)?;

    Ok(RawUri {
        scheme,
        username,
        password,
        hosts,
        database,
        options: parse_query(query)?,
    })
}

fn strip_scheme(uri: &str) -> Result<(Scheme, &str), UriError> {
    let lower = uri.to_ascii_lowercase();
    if lower.starts_with(SRV_PREFIX) {
        Ok((Scheme::Srv, &uri[SRV_PREFIX.len()..]))
    } else if lower.starts_with(STANDARD_PREFIX) {
        Ok((Scheme::Standard, &uri[STANDARD_PREFIX.len()..]))
    } else {
        Err(UriError::MissingScheme)
    }
}

fn split_userinfo(info: &str) -> Result<(Option<String>, Option<String>), UriError> {
    let (user, password) = match info.split_once(':') {
        Some((user, password)) => (user, Some(decode(password)?)),
        None => (info, None),
    };
    let user = decode(user)?;
    if user.is_empty() {
        return Err(UriError::Invalid(
            "The connection string has credentials but no user name.".into(),
        ));
    }
    Ok((Some(user), password))
}

fn parse_hosts(list: &str, scheme: Scheme) -> Result<Vec<HostPort>, UriError> {
    if list.is_empty() {
        return Err(UriError::MissingHost);
    }
    let hosts = list
        .split(',')
        .map(parse_host)
        .collect::<Result<Vec<_>, _>>()?;
    if scheme == Scheme::Srv && (hosts.len() != 1 || hosts.iter().any(|h| h.port.is_some())) {
        return Err(UriError::InvalidSrvHost);
    }
    Ok(hosts)
}

fn parse_host(entry: &str) -> Result<HostPort, UriError> {
    let (host, port) = if let Some(ipv6) = entry.strip_prefix('[') {
        let (host, after) = ipv6
            .split_once(']')
            .ok_or_else(|| UriError::Invalid(format!("\"{entry}\" is not a valid IPv6 host.")))?;
        (host.to_owned(), after.strip_prefix(':'))
    } else {
        match entry.rsplit_once(':') {
            Some((host, port)) => (decode(host)?, Some(port)),
            None => (decode(entry)?, None),
        }
    };
    if host.is_empty() {
        return Err(UriError::MissingHost);
    }
    let port = port
        .map(|raw| {
            raw.parse::<u16>()
                .ok()
                .filter(|port| *port != 0)
                .ok_or_else(|| UriError::InvalidPort(raw.to_owned()))
        })
        .transpose()?;
    Ok(HostPort { host, port })
}

fn split_tail(tail: &str) -> Result<(Option<String>, &str), UriError> {
    let (path, query) = match tail.split_once('?') {
        Some((path, query)) => (path, query),
        None => (tail, ""),
    };
    let database = path.strip_prefix('/').unwrap_or(path);
    let database = if database.is_empty() {
        None
    } else {
        Some(decode(database)?)
    };
    Ok((database, query))
}

fn parse_query(query: &str) -> Result<Vec<(String, String)>, UriError> {
    query
        .split(['&', ';'])
        .filter(|pair| !pair.is_empty())
        .map(|pair| {
            let (key, value) = pair
                .split_once('=')
                .ok_or_else(|| UriError::MissingValue(pair.to_owned()))?;
            Ok((decode(key)?, decode(value)?))
        })
        .collect()
}
