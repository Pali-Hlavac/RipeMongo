//! Builds the [`AppInfo`] payload independently of Tauri so it can be unit tested.

use serde::Serialize;
use specta::Type;

/// Name, version and platform of the running app, shown in the status bar and About dialog.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct AppInfo {
    /// Product name from `tauri.conf.json`.
    pub name: String,
    /// Semantic version from `tauri.conf.json`.
    pub version: String,
    /// Operating system family, e.g. `windows`, `macos`, `linux`.
    pub os: String,
    /// CPU architecture, e.g. `x86_64`, `aarch64`.
    pub arch: String,
}

impl AppInfo {
    /// Combines the package name/version with the compile-time target platform.
    pub fn new(name: impl Into<String>, version: impl Into<String>) -> Self {
        Self {
            name: name.into(),
            version: version.into(),
            os: std::env::consts::OS.to_owned(),
            arch: std::env::consts::ARCH.to_owned(),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn fills_platform_from_build_target() {
        let info = AppInfo::new("RipeMongo", "1.2.3");
        assert_eq!(info.name, "RipeMongo");
        assert_eq!(info.version, "1.2.3");
        assert_eq!(info.os, std::env::consts::OS);
        assert_eq!(info.arch, std::env::consts::ARCH);
    }
}
