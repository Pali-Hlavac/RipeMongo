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
- **Storage:** `SettingsStore` = `JsonFile<Settings>` (see `storage`).

## `storage`

- **Purpose:** typed JSON documents on disk (`JsonFile<T>`): defaults for missing files,
  tolerant parsing, atomic writes serialized by a mutex. Used by `settings` and `connections`.
- **Errors:** `StorageError::{Io, Parse, Serialize}` → `IO`, `INVALID_DATA`, `INTERNAL`.

## `secrets`

- **Purpose:** the `SecretStore` trait with `KeyringSecretStore` (OS keychain via `keyring` 4,
  service `com.ripemongo.app`) and `MemorySecretStore` (tests).
- **Errors:** `SecretsError::{Unavailable, Platform}` → `KEYCHAIN` with platform hints.

## `connections`

- **Purpose:** saved profiles, connection strings, per-connection secrets, live clients and
  import/export. Entry point: `ConnectionManager` (`service.rs`), registered by
  `connections::init`.
- **Key files:** `config.rs`/`types.rs` (model), `uri/` (parse/build/redact), `secrets.rs`
  (keychain keys, `SecretUpdates`), `validation.rs`, `repository.rs` (`connections.json`),
  `client.rs` (driver client + tunnel), `registry.rs` (live clients), `server_info.rs`
  (`hello` + `buildInfo`), `transfer/` (export/import, Argon2id + XChaCha20-Poly1305),
  `commands.rs`.
- **Errors:** `ConnectionError` → `NOT_FOUND`, `INVALID_INPUT`, `CONNECTION_FAILED`,
  `AUTH_FAILED`, plus storage/keychain/SSH codes. Driver messages are shortened and redacted.
- **Docs:** [features/connections.md](../features/connections.md).

## `mongo`

- **Purpose:** shared plumbing for modules that talk to a live server: `client(manager, id)` and
  `database(manager, id, db)` look up the open client (`NOT_CONNECTED` otherwise),
  `require_name`, and `MongoError` with `driver_error()`, which maps server error codes
  (13/18 → `FORBIDDEN`, 26 → `NOT_FOUND`, 48 → already exists, 50 → `TIMEOUT`, 73 → invalid
  name, 121 → validation, 11000 → duplicate key) to user-facing errors.

## `ejson`

- **Purpose:** parse what users type (JSON, Extended JSON, mongosh syntax such as unquoted
  keys, `ObjectId(…)`, `ISODate(…)`, `/re/i`) into BSON with line/column errors, and serialize
  documents as canonical Extended JSON (`to_canonical_json`). See ADR 0012 (planned).
- **Errors:** `EjsonError` → `INVALID_INPUT`.

## `databases`

- **Purpose:** `list_databases` (with `authorizedDatabases`), `create_database` (creates the
  first collection, since MongoDB stores databases lazily), `drop_database`.
- **Docs:** [features/navigation.md](../features/navigation.md).

## `collections`

- **Purpose:** list collections and views (`system.*` hidden), `$collStats` statistics summed
  over shards, create standard/capped/time-series collections (`options.rs` validates
  `NewCollectionOptions`), create views from a pipeline, rename (`renameCollection`, never
  dropping the target), drop.
- **Docs:** [features/navigation.md](../features/navigation.md).

## `ssh`

- **Purpose:** `SshTunnel::open` forwards a random loopback port to the MongoDB host through a
  bastion (russh with the `ring` backend). `host_keys.rs` verifies server keys (user
  known_hosts, then RipeMongo's own; trust on first use; changed keys rejected). See ADR 0013.
- **Errors:** `SshError` → `SSH_FAILED` with a specific hint per cause.

## Planned modules

| Module                           | Milestone | Purpose                                        |
| -------------------------------- | --------- | ---------------------------------------------- |
| `documents`                      | 3         | Find with paging, document CRUD                |
| `jobs`, `tools`, `import_export` | 4         | Background jobs, sidecar runner, import/export |
| `aggregation`                    | 5         | Pipeline execution and previews                |
| `indexes`, `validation`          | 6         | Index and validator management, explain        |
| `schema`, `server_stats`         | 7         | Schema sampling, performance metrics           |
| `console`                        | 8         | `runCommand` console                           |
