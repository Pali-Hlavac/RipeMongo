//! Percent-encoding sets and decoding for the parts of a connection string.

use percent_encoding::{
    percent_decode_str, utf8_percent_encode, AsciiSet, CONTROLS, NON_ALPHANUMERIC,
};

use super::UriError;

/// User names and passwords: everything except RFC 3986 unreserved characters.
const USERINFO: &AsciiSet = &NON_ALPHANUMERIC
    .remove(b'-')
    .remove(b'.')
    .remove(b'_')
    .remove(b'~');

/// Option values: only characters that would break the query syntax. Paths such as
/// `C:\certs\ca.pem` or `/etc/ssl/ca.pem` stay readable.
const QUERY_VALUE: &AsciiSet = &CONTROLS
    .add(b' ')
    .add(b'"')
    .add(b'#')
    .add(b'%')
    .add(b'&')
    .add(b'+')
    .add(b'<')
    .add(b'>')
    .add(b'=')
    .add(b'`');

/// Database name in the path and Unix-socket host names.
const PATH_SEGMENT: &AsciiSet = &QUERY_VALUE.add(b'/').add(b'?').add(b',').add(b'@');

pub(super) fn encode_userinfo(value: &str) -> String {
    utf8_percent_encode(value, USERINFO).to_string()
}

pub(super) fn encode_query_value(value: &str) -> String {
    utf8_percent_encode(value, QUERY_VALUE).to_string()
}

pub(super) fn encode_path_segment(value: &str) -> String {
    utf8_percent_encode(value, PATH_SEGMENT).to_string()
}

/// Decodes `%XX` sequences; `+` is kept literally as the MongoDB URI spec requires.
pub(super) fn decode(value: &str) -> Result<String, UriError> {
    if has_malformed_escape(value) {
        return Err(UriError::InvalidEncoding(value.to_owned()));
    }
    percent_decode_str(value)
        .decode_utf8()
        .map(|decoded| decoded.into_owned())
        .map_err(|_| UriError::InvalidEncoding(value.to_owned()))
}

/// `percent_decode_str` silently passes through `%zz`; the URI spec says it is an error.
fn has_malformed_escape(value: &str) -> bool {
    let bytes = value.as_bytes();
    bytes.iter().enumerate().any(|(index, byte)| {
        *byte == b'%'
            && !(bytes.get(index + 1).is_some_and(u8::is_ascii_hexdigit)
                && bytes.get(index + 2).is_some_and(u8::is_ascii_hexdigit))
    })
}
