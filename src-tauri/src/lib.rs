//! Library root: wires domain modules, the typed IPC builder and the Tauri runtime together.

mod app_info;
pub mod collections;
pub mod connections;
pub mod databases;
pub mod documents;
pub mod ejson;
pub mod error;
mod ipc;
mod logging;
pub mod mongo;
pub mod secrets;
mod settings;
pub mod ssh;
mod storage;

/// Starts the desktop application. Blocks until the last window closes.
pub fn run() {
    logging::init();
    let builder = ipc::builder();

    #[cfg(debug_assertions)]
    if let Err(error) = ipc::export_bindings(&builder) {
        tracing::warn!(%error, "failed to export TypeScript bindings");
    }

    let result = tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(builder.invoke_handler())
        .setup(move |app| {
            builder.mount_events(app);
            settings::init(app)?;
            connections::init(app)?;
            Ok(())
        })
        .run(tauri::generate_context!());

    if let Err(error) = result {
        tracing::error!(%error, "application exited with an error");
        std::process::exit(1);
    }
}
