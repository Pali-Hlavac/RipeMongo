//! Masks passwords inside any connection strings embedded in a piece of text, so error
//! messages and logs can never leak credentials.

const SCHEME_SEPARATOR: &str = "://";
const MASK: &str = "****";

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
