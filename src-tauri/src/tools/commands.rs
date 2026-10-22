//! Tauri boundary for the bundled tools.

use super::{tools_info, ToolsInfo};

/// Which bundled tools are available, with their versions.
#[tauri::command]
#[specta::specta]
pub async fn get_tools_info() -> ToolsInfo {
    tools_info().await
}
