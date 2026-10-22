//! Tauri boundary for app information.

use tauri::AppHandle;

use super::AppInfo;

/// Returns the app name, version and platform.
#[tauri::command]
#[specta::specta]
pub fn get_app_info(app: AppHandle) -> AppInfo {
    let package = app.package_info();
    AppInfo::new(package.name.clone(), package.version.to_string())
}
