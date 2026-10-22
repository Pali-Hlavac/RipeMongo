//! Settings data model shared with the frontend.

use serde::{Deserialize, Serialize};
use specta::Type;

/// Which color scheme the UI uses.
#[derive(Debug, Clone, Copy, Default, PartialEq, Eq, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub enum ThemePreference {
    /// Follow the operating system setting.
    #[default]
    System,
    Light,
    Dark,
}

/// All persisted user preferences. Unknown fields are ignored and missing fields
/// fall back to defaults, so older and newer app versions can share the file.
#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase", default)]
pub struct Settings {
    pub theme: ThemePreference,
}
