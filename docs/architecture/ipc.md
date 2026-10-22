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

## Calling commands from the frontend

```ts
import { call, commands, unwrap } from "@/shared/ipc/client";

const settings = await unwrap(commands.getSettings()); // fallible: Result<T, AppError>
const info = await call(commands.getAppInfo()); // infallible: T
```

Both helpers throw `IpcError { code, message, hint }`. Never call `invoke` directly.

## Commands

| Command           | Module     | Args                 | Returns    | Errors               |
| ----------------- | ---------- | -------------------- | ---------- | -------------------- |
| `get_app_info`    | `app_info` | none                 | `AppInfo`  | none                 |
| `get_settings`    | `settings` | none                 | `Settings` | `IO`, `INVALID_DATA` |
| `update_settings` | `settings` | `settings: Settings` | `Settings` | `IO`, `INTERNAL`     |

## Events

None yet. Background jobs (milestone 4) will emit typed `tauri-specta` events; see
[background-jobs.md](background-jobs.md).

## Error model

```rust
pub struct AppError { code: ErrorCode, message: String, hint: Option<String> }
```

| Code           | Meaning                                                                        |
| -------------- | ------------------------------------------------------------------------------ |
| `INTERNAL`     | Unexpected failure, likely a bug                                               |
| `IO`           | Local file read/write failed                                                   |
| `INVALID_DATA` | Data on disk or input could not be parsed                                      |
| `IPC_FAILURE`  | Frontend only: Tauri rejected the call (unknown command, ACL denial, bad args) |

Rules:

- Each module has its own `thiserror` enum with technical detail; it is logged with
  `tracing` in the `From<ModuleError> for AppError` impl, then mapped to a user-facing message.
- `message` says what happened in plain language; `hint` says what to do next.
- Never put secrets (passwords, full connection strings) in messages or logs.

## Permissions (ACL)

App commands are not callable unless listed in `APP_COMMANDS` (`src-tauri/build.rs`) **and**
granted as `allow-<kebab-name>` in `src-tauri/capabilities/default.json`. See
[security.md](security.md).
