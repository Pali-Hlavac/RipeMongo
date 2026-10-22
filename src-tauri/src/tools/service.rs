//! Reports which tools are available and their versions.

use std::time::Duration;

use super::{locate, tool_command, Tool, ToolStatus, ToolsInfo};

/// How long `<tool> --version` may take before the tool counts as not runnable.
const VERSION_TIMEOUT: Duration = Duration::from_secs(10);

/// Runs `--version` on every tool. Missing or broken tools get `version: None`.
pub async fn tools_info() -> ToolsInfo {
    let mut tools = Vec::with_capacity(Tool::ALL.len());
    for tool in Tool::ALL {
        tools.push(ToolStatus {
            tool,
            version: version(tool).await,
        });
    }
    ToolsInfo { tools }
}

async fn version(tool: Tool) -> Option<String> {
    let path = locate(tool).ok()?;
    let output = tokio::time::timeout(
        VERSION_TIMEOUT,
        tool_command(&path).arg("--version").output(),
    )
    .await
    .ok()?
    .ok()?;
    if !output.status.success() {
        tracing::warn!(%tool, status = %output.status, "tool --version failed");
        return None;
    }
    parse_version(&String::from_utf8_lossy(&output.stdout))
}

/// `mongodump version: 100.19.1` (first line of `--version`) → `100.19.1`.
fn parse_version(output: &str) -> Option<String> {
    output
        .lines()
        .next()?
        .split_once("version:")
        .map(|(_, version)| version.trim().to_owned())
        .filter(|version| !version.is_empty())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_the_first_version_line() {
        let output = "mongodump version: 100.19.1\ngit version: 9348e03\nGo version: go1.26.8\n";
        assert_eq!(parse_version(output).as_deref(), Some("100.19.1"));
        assert_eq!(parse_version("something else"), None);
        assert_eq!(parse_version(""), None);
    }
}
