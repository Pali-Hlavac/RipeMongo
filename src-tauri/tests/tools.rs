//! Integration test: the binaries fetched by `pnpm sidecars` run and match the pinned version.
//! Skipped when they have not been fetched.

use ripemongo_lib::tools::{locate, tools_info, Tool};

const LOCK_FILE: &str = concat!(env!("CARGO_MANIFEST_DIR"), "/../scripts/sidecars.lock.json");

#[tokio::test]
async fn fetched_tools_report_the_pinned_version() {
    if Tool::ALL.iter().any(|tool| locate(*tool).is_err()) {
        eprintln!("skipped: run `pnpm sidecars` to fetch the MongoDB tools");
        return;
    }
    let lock: serde_json::Value =
        serde_json::from_str(&std::fs::read_to_string(LOCK_FILE).unwrap()).unwrap();
    let pinned = lock["version"].as_str().unwrap();
    for status in tools_info().await.tools {
        assert_eq!(status.version.as_deref(), Some(pinned), "{}", status.tool);
    }
}
