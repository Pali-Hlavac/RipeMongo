//! Types describing the bundled tools.

use serde::{Deserialize, Serialize};
use specta::Type;

/// One of the bundled MongoDB Database Tools.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize, Type)]
#[serde(rename_all = "lowercase")]
pub enum Tool {
    Mongodump,
    Mongorestore,
    Mongoexport,
    Mongoimport,
}

impl Tool {
    /// Every bundled tool, in the order they are listed to the user.
    pub const ALL: [Tool; 4] = [
        Tool::Mongodump,
        Tool::Mongorestore,
        Tool::Mongoexport,
        Tool::Mongoimport,
    ];

    /// Program name without extension, e.g. `mongodump`.
    pub fn program(self) -> &'static str {
        match self {
            Tool::Mongodump => "mongodump",
            Tool::Mongorestore => "mongorestore",
            Tool::Mongoexport => "mongoexport",
            Tool::Mongoimport => "mongoimport",
        }
    }
}

impl std::fmt::Display for Tool {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.write_str(self.program())
    }
}

/// Whether a tool was found and which version it reports.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct ToolStatus {
    pub tool: Tool,
    /// `None` when the binary is missing or could not be run.
    pub version: Option<String>,
}

/// The bundled tools and their versions (shown in the About dialog).
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct ToolsInfo {
    pub tools: Vec<ToolStatus>,
}
