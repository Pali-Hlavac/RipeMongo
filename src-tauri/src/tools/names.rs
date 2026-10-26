//! Database and collection names: what MongoDB accepts, and escaping them in the tools'
//! namespace patterns (`--nsInclude`, `--nsFrom`, …).

use super::ToolsError;

/// Characters a database name cannot contain (MongoDB's rules, Windows included).
const FORBIDDEN_DATABASE_CHARS: &str = "/\\. \"$*<>:|?";
/// Longest database name MongoDB accepts, in bytes.
const MAX_DATABASE_NAME_BYTES: usize = 63;
/// Characters a collection name cannot contain.
const FORBIDDEN_COLLECTION_CHARS: [char; 2] = ['$', '\0'];

/// Checks a non-empty database name (callers word the "enter a name" message themselves).
pub fn check_database_name(name: &str) -> Result<(), ToolsError> {
    if name.len() > MAX_DATABASE_NAME_BYTES
        || name
            .chars()
            .any(|c| FORBIDDEN_DATABASE_CHARS.contains(c) || c == '\0')
    {
        return Err(ToolsError::Invalid(format!(
            "“{name}” cannot be a database name: use at most {MAX_DATABASE_NAME_BYTES} \
             characters, without spaces or any of / \\ . \" $ * < > : | ?"
        )));
    }
    Ok(())
}

/// Checks a non-empty collection name.
pub fn check_collection_name(name: &str) -> Result<(), ToolsError> {
    if name.contains(FORBIDDEN_COLLECTION_CHARS) || name.starts_with("system.") {
        return Err(ToolsError::Invalid(format!(
            "“{name}” cannot be a collection name: it must not contain $ or start with “system.”."
        )));
    }
    Ok(())
}

/// Namespace patterns treat `*` as a wildcard and `$` as a variable; `\` escapes both.
pub fn escape_namespace(name: &str) -> String {
    let mut escaped = String::with_capacity(name.len());
    for c in name.chars() {
        if matches!(c, '\\' | '*' | '$') {
            escaped.push('\\');
        }
        escaped.push(c);
    }
    escaped
}
