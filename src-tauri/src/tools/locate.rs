//! Finds the sidecar binaries: next to the app executable in installed builds, and in
//! `src-tauri/binaries/` (as fetched by `pnpm sidecars`) in development builds.

use std::path::{Path, PathBuf};

use super::{Tool, ToolsError};

/// Target triple the app was compiled for (set by `build.rs`); part of sidecar file names.
const TARGET_TRIPLE: &str = env!("RIPEMONGO_TARGET_TRIPLE");
/// Folder of the fetched binaries, relative to the crate root.
const DEV_BINARIES_DIR: &str = "binaries";

/// Absolute path of a tool's binary, or [`ToolsError::Missing`].
pub fn locate(tool: Tool) -> Result<PathBuf, ToolsError> {
    candidates(tool)
        .into_iter()
        .find(|path| path.is_file())
        .ok_or(ToolsError::Missing(tool))
}

fn candidates(tool: Tool) -> Vec<PathBuf> {
    let mut paths = Vec::new();
    // Installed apps: Tauri copies `externalBin` next to the executable, without the triple.
    if let Some(dir) = std::env::current_exe()
        .ok()
        .and_then(|exe| exe.parent().map(Path::to_path_buf))
    {
        paths.push(dir.join(file_name(tool, None)));
    }
    if cfg!(debug_assertions) {
        paths.push(
            Path::new(env!("CARGO_MANIFEST_DIR"))
                .join(DEV_BINARIES_DIR)
                .join(file_name(tool, Some(TARGET_TRIPLE))),
        );
    }
    paths
}

/// `mongodump[-<triple>][.exe]`.
fn file_name(tool: Tool, triple: Option<&str>) -> String {
    let suffix = triple
        .map(|triple| format!("-{triple}"))
        .unwrap_or_default();
    format!("{}{suffix}{}", tool.program(), std::env::consts::EXE_SUFFIX)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn names_follow_tauri_external_bin_conventions() {
        let exe = std::env::consts::EXE_SUFFIX;
        assert_eq!(file_name(Tool::Mongodump, None), format!("mongodump{exe}"));
        assert_eq!(
            file_name(Tool::Mongoimport, Some("x86_64-pc-windows-msvc")),
            format!("mongoimport-x86_64-pc-windows-msvc{exe}")
        );
    }

    #[test]
    fn development_builds_also_look_in_the_fetched_binaries() {
        let paths = candidates(Tool::Mongorestore);
        let last = paths.last().unwrap();
        assert!(last.ends_with(file_name(Tool::Mongorestore, Some(TARGET_TRIPLE))));
        assert!(last.parent().unwrap().ends_with(DEV_BINARIES_DIR));
    }
}
