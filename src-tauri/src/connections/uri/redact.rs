//! Masks passwords inside any connection strings embedded in a piece of text, so error
//! messages and logs can never leak credentials.

use super::encode::{encode_query_value, encode_userinfo};

const SCHEME_SEPARATOR: &str = "://";
const MASK: &str = "****";
/// Shorter secrets are masked only where they appear as a URI password: masking every
/// occurrence of, say, "abc" would garble the rest of the text.
const MIN_MASKED_LEN: usize = 4;

/// Masks known secret values wherever they appear, as typed and as encoded inside a
/// connection string, plus every URI password ([`redact_uri`]). The bundled tools print
/// their whole connection string when they cannot connect. Deliberately not `Debug`.
#[derive(Clone, Default)]
pub struct SecretMask {
    /// Longest first, so a secret containing another one is masked whole.
    values: Vec<String>,
}

impl SecretMask {
    pub fn new<'a>(secrets: impl IntoIterator<Item = &'a str>) -> Self {
        let mut values: Vec<String> = secrets
            .into_iter()
            .flat_map(|secret| {
                [
                    secret.to_owned(),
                    encode_userinfo(secret),
                    encode_query_value(secret),
                ]
            })
            .filter(|value| value.chars().count() >= MIN_MASKED_LEN)
            .collect();
        values.sort_by(|a, b| b.len().cmp(&a.len()).then_with(|| a.cmp(b)));
        values.dedup();
        Self { values }
    }

    /// `text` with every secret replaced by `****`.
    pub fn apply(&self, text: &str) -> String {
        let masked = self.values.iter().fold(text.to_owned(), |text, secret| {
            text.replace(secret.as_str(), MASK)
        });
        redact_uri(&masked)
    }
}

/// Replaces `user:password@` with `user:****@` in every URI found in `text`.
pub fn redact_uri(text: &str) -> String {
    let mut output = String::with_capacity(text.len());
    let mut rest = text;
    while let Some(index) = rest.find(SCHEME_SEPARATOR) {
        let authority_start = index + SCHEME_SEPARATOR.len();
        output.push_str(&rest[..authority_start]);
        rest = &rest[authority_start..];

        let authority_end = rest
            .find(|c: char| {
                matches!(c, '/' | '?' | '#') || c.is_whitespace() || c == '"' || c == '\''
            })
            .unwrap_or(rest.len());
        let authority = &rest[..authority_end];
        match authority
            .rfind('@')
            .and_then(|at| authority[..at].find(':').map(|colon| (colon, at)))
        {
            Some((colon, at)) => {
                output.push_str(&authority[..=colon]);
                output.push_str(MASK);
                output.push_str(&authority[at..]);
            }
            None => output.push_str(authority),
        }
        rest = &rest[authority_end..];
    }
    output.push_str(rest);
    output
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn masks_secrets_as_typed_and_as_encoded() {
        let mask = SecretMask::new(["p@ss word", "tok", "KEYPASS1"]);
        let line = "failed to connect to mongodb://ann:p%40ss%20word@h:1/?\
                    tlsCertificateKeyFilePassword=KEYPASS1: auth failed for p@ss word (tok)";
        assert_eq!(
            mask.apply(line),
            "failed to connect to mongodb://ann:****@h:1/?\
             tlsCertificateKeyFilePassword=****: auth failed for **** (tok)"
        );
        // Short secrets are still masked as a URI password.
        assert_eq!(
            SecretMask::new(["tok"]).apply("mongodb://u:tok@h/"),
            "mongodb://u:****@h/"
        );
        assert_eq!(SecretMask::default().apply("plain"), "plain");
    }
}
