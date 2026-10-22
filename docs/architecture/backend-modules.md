# Backend modules (`src-tauri/src`)

Every domain module follows the same layout:

```
<module>/
  mod.rs       public surface + init(app) when the module manages state
  commands.rs  #[tauri::command] fns: thin, no logic
  service.rs   logic, unit tests in the same file
  error.rs     thiserror enum + From<ModuleError> for AppError
  types.rs     serde + specta types crossing IPC
```

## Crate root

| File         | Purpose                                                                  |
| ------------ | ------------------------------------------------------------------------ |
| `main.rs`    | Binary entry; hides the console on Windows release builds                |
| `lib.rs`     | `run()`: logging, IPC registry, Tauri builder, module `init`s            |
| `ipc.rs`     | `builder()` command registry, `export_bindings()`                        |
| `error.rs`   | `AppError`, `ErrorCode`, `CommandResult<T>`                              |
| `logging.rs` | `tracing` subscriber; `RUST_LOG` overrides the default filter            |
| `build.rs`   | ACL command manifest; Windows Common-Controls manifest for test binaries |

## `app_info`

- **Purpose:** name, version and platform of the running app.
- **Public API:** `get_app_info` command, `AppInfo` type.
- **Key files:** `app_info/service.rs` (`AppInfo::new`), `app_info/commands.rs`.

## `settings`

- **Purpose:** persist user preferences (currently the theme) as JSON.
- **Public API:** `get_settings`, `update_settings`; `Settings`, `ThemePreference`;
  `SettingsStore` managed state; `settings::init(app)`.
- **Behaviour:** missing file → defaults; unknown/missing fields tolerated
  (`#[serde(default)]`); writes are serialized by a mutex and atomic (temp file + rename).
- **Errors:** `SettingsError::{Io, Parse, Serialize}` → `IO`, `INVALID_DATA`, `INTERNAL`.
- **Key files:** `settings/service.rs`, `settings/error.rs`, `settings/types.rs`.

## Planned modules

| Module                                  | Milestone | Purpose                                                   |
| --------------------------------------- | --------- | --------------------------------------------------------- |
| `connections`, `secrets`, `ssh`         | 2         | Saved connections, keychain, SSH tunnels, client registry |
| `databases`, `collections`, `documents` | 3         | Browsing and CRUD                                         |
| `jobs`, `tools`, `import_export`        | 4         | Background jobs, sidecar runner, import/export            |
| `aggregation`                           | 5         | Pipeline execution and previews                           |
| `indexes`, `validation`                 | 6         | Index and validator management, explain                   |
| `schema`, `server_stats`                | 7         | Schema sampling, performance metrics                      |
| `console`                               | 8         | `runCommand` console                                      |
