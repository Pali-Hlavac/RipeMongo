//! The equivalent command line shown to the user (copyable). It uses `--uri` without any
//! secret, while the real run passes the full connection string in a `--config` file.

use super::Tool;

/// `mongodump --uri="mongodb://user@host/" --db=shop --out="C:\My dumps"`.
pub fn display_command(tool: Tool, display_uri: &str, args: &[String]) -> String {
    let mut parts = vec![
        tool.program().to_owned(),
        format!("--uri={}", quote(display_uri)),
    ];
    parts.extend(args.iter().map(|arg| match arg.split_once('=') {
        Some((flag, value)) => format!("{flag}={}", quote(value)),
        None => quote(arg),
    }));
    parts.join(" ")
}

/// Leaves simple values bare, single-quotes JSON (as in the tools' own docs) and
/// double-quotes everything else. Backslashes stay as they are (Windows paths); only `"` is
/// escaped, which Windows paths cannot contain.
fn quote(value: &str) -> String {
    let simple = !value.is_empty()
        && value
            .chars()
            .all(|c| c.is_ascii_alphanumeric() || "-_./:@,+".contains(c));
    if simple {
        value.to_owned()
    } else if value.contains('"') && !value.contains('\'') {
        format!("'{value}'")
    } else {
        format!("\"{}\"", value.replace('"', "\\\""))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn quotes_values_with_spaces_and_shell_characters() {
        let args = vec![
            "--db=shop".to_owned(),
            r"--out=C:\My dumps".to_owned(),
            "--gzip".to_owned(),
            r#"--query={"n":{"$numberInt":"1"}}"#.to_owned(),
        ];
        assert_eq!(
            display_command(
                Tool::Mongodump,
                "mongodb://ann@localhost:27017/?tls=true",
                &args
            ),
            r#"mongodump --uri="mongodb://ann@localhost:27017/?tls=true" --db=shop --out="C:\My dumps" --gzip --query='{"n":{"$numberInt":"1"}}'"#
        );
    }
}
