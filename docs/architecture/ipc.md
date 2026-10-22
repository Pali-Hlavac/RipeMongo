# IPC: commands, events, errors and type generation

## Type generation

- Rust is the source of truth. Command signatures and every type deriving `specta::Type`
  are exported by [tauri-specta](https://github.com/specta-rs/tauri-specta) into
  `src/shared/ipc/bindings.ts`.
- The registry is `builder()` in `src-tauri/src/ipc.rs`.
- Regenerate with `pnpm bindings` (runs the `ipc::tests::export_bindings` test). Debug app
  runs also regenerate it. CI fails if the committed file is stale.
- Serde shapes are exported per phase: a type with `#[serde(default)]` has
  `Foo_Serialize` (what Rust sends; all fields present) and `Foo_Deserialize` (what Rust
  accepts; fields optional). Use `_Serialize` for data you receive.
- Exported numbers must fit in a JS `number`: no `i64`/`u64` in IPC types.
- `disable_serde_phases()` is on: each Rust type has one TS type. The UI always sends
  complete objects (`null` for absent optionals).

## Calling commands from the frontend

```ts
import { call, commands, unwrap } from "@/shared/ipc/client";

const settings = await unwrap(commands.getSettings()); // fallible: Result<T, AppError>
const info = await call(commands.getAppInfo()); // infallible: T
```

Both helpers throw `IpcError { code, message, hint }`. Never call `invoke` directly.
Mutations whose errors are rendered inline set `meta: { silent: true }` to skip the global
error toast (`src/app/query-client.ts`).

## Commands

| Command                    | Module                  | Args                                           | Returns                         | Errors                                                                        |
| -------------------------- | ----------------------- | ---------------------------------------------- | ------------------------------- | ----------------------------------------------------------------------------- |
| `get_app_info`             | `app_info`              | none                                           | `AppInfo`                       | none                                                                          |
| `get_settings`             | `settings`              | none                                           | `Settings`                      | `IO`, `INVALID_DATA`                                                          |
| `update_settings`          | `settings`              | `settings: Settings`                           | `Settings`                      | `IO`, `INTERNAL`                                                              |
| `list_connections`         | `connections`           | none                                           | `ConnectionProfile[]`           | `IO`, `INVALID_DATA`                                                          |
| `save_connection`          | `connections`           | `profile`, `secrets: SecretUpdates`            | `ConnectionProfile`             | `INVALID_INPUT`, `IO`, `KEYCHAIN`                                             |
| `delete_connection`        | `connections`           | `connectionId`                                 | `null`                          | `NOT_FOUND`, `IO`, `KEYCHAIN`                                                 |
| `duplicate_connection`     | `connections`           | `connectionId`                                 | `ConnectionProfile`             | `NOT_FOUND`, `KEYCHAIN`                                                       |
| `get_stored_secrets`       | `connections`           | `connectionId`                                 | `StoredSecrets` (booleans only) | `KEYCHAIN`                                                                    |
| `parse_connection_string`  | `connections`           | `uri`                                          | `ParsedConnectionString`        | `INVALID_INPUT`                                                               |
| `build_connection_string`  | `connections`           | `config`                                       | `string` (no secrets)           | none                                                                          |
| `test_connection`          | `connections`           | `config`, `connectionId` (nullable), `secrets` | `ServerInfo`                    | `CONNECTION_FAILED`, `AUTH_FAILED`, `SSH_FAILED`, `INVALID_INPUT`, `KEYCHAIN` |
| `open_connection`          | `connections`           | `connectionId`                                 | `ActiveConnectionInfo`          | as `test_connection`, `NOT_FOUND`                                             |
| `close_connection`         | `connections`           | `connectionId`                                 | `null`                          | none                                                                          |
| `list_active_connections`  | `connections`           | none                                           | `ActiveConnectionInfo[]`        | none                                                                          |
| `export_connections`       | `connections::transfer` | `path`, `connectionIds`, `password` (nullable) | `null`                          | `IO`                                                                          |
| `inspect_connections_file` | `connections::transfer` | `path`                                         | `ConnectionsFileInfo`           | `IO`, `INVALID_DATA`                                                          |
| `import_connections`       | `connections::transfer` | `path`, `password` (nullable)                  | `ImportSummary`                 | `IO`, `INVALID_DATA`, `INVALID_INPUT` (wrong password)                        |

Plugin permissions: `dialog:allow-open`, `dialog:allow-save` (native file pickers; the chosen
path is passed to the commands above).

## Events

None yet. Background jobs (milestone 4) will emit typed `tauri-specta` events; see
[background-jobs.md](background-jobs.md).

## Error model

```rust
pub struct AppError { code: ErrorCode, message: String, hint: Option<String> }
```

| Code                | Meaning                                                                                |
| ------------------- | -------------------------------------------------------------------------------------- |
| `INTERNAL`          | Unexpected failure, likely a bug                                                       |
| `IO`                | Local file read/write failed                                                           |
| `INVALID_DATA`      | Data on disk or input could not be parsed                                              |
| `INVALID_INPUT`     | User input is incomplete or contradictory (validation, bad URI, wrong export password) |
| `NOT_FOUND`         | The requested connection does not exist                                                |
| `KEYCHAIN`          | The OS keychain is unavailable or refused access                                       |
| `CONNECTION_FAILED` | The server could not be reached or selected (including DNS/SRV)                        |
| `AUTH_FAILED`       | The server rejected the credentials                                                    |
| `SSH_FAILED`        | The SSH tunnel could not be established                                                |
| `IPC_FAILURE`       | Frontend only: Tauri rejected the call (unknown command, ACL denial, bad args)         |

Rules:

- Each module has its own `thiserror` enum with technical detail; it is logged with
  `tracing` in the `From<ModuleError> for AppError` impl, then mapped to a user-facing message.
- `message` says what happened in plain language; `hint` says what to do next.
- Never put secrets (passwords, full connection strings) in messages or logs.

## Permissions (ACL)

App commands are not callable unless listed in `APP_COMMANDS` (`src-tauri/build.rs`) **and**
granted as `allow-<kebab-name>` in `src-tauri/capabilities/default.json`. See
[security.md](security.md).
