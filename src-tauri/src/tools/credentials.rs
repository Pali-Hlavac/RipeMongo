//! Passes the connection string to a tool through a temporary `--config` file, so the
//! password never appears on a command line (where other processes could read it).

use std::io::Write;

use tempfile::NamedTempFile;

const PREFIX: &str = "ripemongo-";
const SUFFIX: &str = ".yaml";

/// A YAML file with `uri: "<connection string>"`, readable only by the current user
/// (`0600` on Unix; the per-user temp folder on Windows). Deleted when dropped.
pub struct CredentialsFile {
    file: NamedTempFile,
}

impl CredentialsFile {
    pub fn new(uri: &str) -> std::io::Result<Self> {
        let mut file = tempfile::Builder::new()
            .prefix(PREFIX)
            .suffix(SUFFIX)
            .tempfile()?;
        writeln!(file, "uri: {}", yaml_quote(uri))?;
        file.flush()?;
        Ok(Self { file })
    }

    /// The `--config=<path>` argument.
    pub fn arg(&self) -> String {
        format!("--config={}", self.file.path().display())
    }
}

/// A YAML double-quoted scalar.
fn yaml_quote(value: &str) -> String {
    let mut quoted = String::with_capacity(value.len() + 2);
    quoted.push('"');
    for c in value.chars() {
        match c {
            '"' => quoted.push_str("\\\""),
            '\\' => quoted.push_str("\\\\"),
            c if c.is_control() => quoted.push_str(&format!("\\u{:04x}", u32::from(c))),
            c => quoted.push(c),
        }
    }
    quoted.push('"');
    quoted
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn quotes_yaml_special_characters() {
        assert_eq!(
            yaml_quote(r#"mongodb://u:p"\x@h/?a=b#c"#),
            r#""mongodb://u:p\"\\x@h/?a=b#c""#
        );
        assert_eq!(yaml_quote("a\nb"), r#""a\u000ab""#);
    }

    #[test]
    fn writes_the_uri_and_deletes_the_file_on_drop() {
        let file = CredentialsFile::new("mongodb://u:secret@localhost/").unwrap();
        let path = file.file.path().to_path_buf();
        assert_eq!(
            std::fs::read_to_string(&path).unwrap(),
            "uri: \"mongodb://u:secret@localhost/\"\n"
        );
        assert!(file.arg().starts_with("--config="));
        drop(file);
        assert!(!path.exists());
    }
}
