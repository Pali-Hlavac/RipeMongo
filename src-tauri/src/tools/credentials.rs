//! Passes the connection string to a tool through a temporary `--config` file, so the
//! password never appears on a command line (where other processes could read it), and
//! masks the connection's secrets in what the tool prints.

use std::io::Write;

use tempfile::NamedTempFile;

use crate::connections::uri::SecretMask;
use crate::connections::ToolConnection;

const PREFIX: &str = "ripemongo-";
const SUFFIX: &str = ".yaml";

/// A YAML file with `uri: "<connection string>"`, readable only by the current user
/// (`0600` on Unix; the per-user temp folder on Windows). Deleted when dropped.
pub struct CredentialsFile {
    file: NamedTempFile,
    mask: SecretMask,
}

impl CredentialsFile {
    pub fn new(connection: &ToolConnection) -> std::io::Result<Self> {
        Self::write(connection.uri(), connection.mask().clone())
    }

    fn write(uri: &str, mask: SecretMask) -> std::io::Result<Self> {
        let mut file = tempfile::Builder::new()
            .prefix(PREFIX)
            .suffix(SUFFIX)
            .tempfile()?;
        writeln!(file, "uri: {}", yaml_quote(uri))?;
        file.flush()?;
        Ok(Self { file, mask })
    }

    /// A line of tool output without the connection's secrets: the tools print their whole
    /// connection string, password included, when they cannot connect.
    pub fn redact(&self, line: &str) -> String {
        self.mask.apply(line)
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
        let file =
            CredentialsFile::write("mongodb://u:secret@localhost/", SecretMask::new(["secret"]))
                .unwrap();
        let path = file.file.path().to_path_buf();
        assert_eq!(
            std::fs::read_to_string(&path).unwrap(),
            "uri: \"mongodb://u:secret@localhost/\"\n"
        );
        assert!(file.arg().starts_with("--config="));
        assert_eq!(
            file.redact("failed to connect to mongodb://u:secret@localhost/"),
            "failed to connect to mongodb://u:****@localhost/"
        );
        drop(file);
        assert!(!path.exists());
    }
}
