//! Build script: generates Tauri context and per-command ACL permissions.
//!
//! Every app command must be listed in `APP_COMMANDS`; Tauri then generates an
//! `allow-<command>` permission that has to be granted in `capabilities/`.
//! Unlisted commands are rejected at runtime.

const APP_COMMANDS: &[&str] = &["get_app_info", "get_settings", "update_settings"];

/// Common-Controls v6 manifest, embedded into every linked artifact on Windows.
const WINDOWS_MANIFEST: &str = "windows-app-manifest.xml";

fn main() {
    let mut windows = tauri_build::WindowsAttributes::new();
    if is_windows_msvc_target() {
        // Tauri only embeds the manifest into the app binary, so `cargo test` executables
        // crash with STATUS_ENTRYPOINT_NOT_FOUND. Embedding it via the linker covers both.
        windows = tauri_build::WindowsAttributes::new_without_app_manifest();
        println!("cargo:rerun-if-changed={WINDOWS_MANIFEST}");
        println!("cargo:rustc-link-arg=/MANIFEST:EMBED");
        let manifest_dir = std::env::var("CARGO_MANIFEST_DIR").unwrap_or_default();
        let manifest = std::path::Path::new(&manifest_dir).join(WINDOWS_MANIFEST);
        println!("cargo:rustc-link-arg=/MANIFESTINPUT:{}", manifest.display());
    }

    let attributes = tauri_build::Attributes::new()
        .windows_attributes(windows)
        .app_manifest(tauri_build::AppManifest::new().commands(APP_COMMANDS));
    if let Err(error) = tauri_build::try_build(attributes) {
        panic!("tauri build script failed: {error:#}");
    }
}

fn is_windows_msvc_target() -> bool {
    let target_os = std::env::var("CARGO_CFG_TARGET_OS").unwrap_or_default();
    let target_env = std::env::var("CARGO_CFG_TARGET_ENV").unwrap_or_default();
    target_os == "windows" && target_env == "msvc"
}
