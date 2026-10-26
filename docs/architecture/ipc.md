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

| Command                    | Module                  | Args                                                                                                 | Returns                                                            | Errors                                                                                                            |
| -------------------------- | ----------------------- | ---------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------- |
| `get_app_info`             | `app_info`              | none                                                                                                 | `AppInfo`                                                          | none                                                                                                              |
| `get_tools_info`           | `tools`                 | none                                                                                                 | `ToolsInfo`                                                        | none                                                                                                              |
| `start_dump`               | `tools`                 | `connectionId, request: DumpRequest`                                                                 | `JobInfo`                                                          | `NOT_CONNECTED`, `INVALID_INPUT`, `IO`                                                                            |
| `inspect_dump`             | `tools`                 | `source: RestoreSource`                                                                              | `DumpContents` (namespaces, gzip, oplog)                           | `INVALID_INPUT` (not a dump, unreadable, relative path)                                                           |
| `start_restore`            | `tools`                 | `connectionId, request: RestoreRequest`                                                              | `JobInfo`                                                          | `NOT_CONNECTED`, `INVALID_INPUT`, `IO`                                                                            |
| `start_export`             | `tools`                 | `connectionId, request: ExportRequest`                                                               | `JobInfo`                                                          | `NOT_CONNECTED`, `INVALID_INPUT`, `IO`                                                                            |
| `list_dump_profiles`       | `dump_profiles`         | none                                                                                                 | `DumpProfile[]` (with the connection name)                         | `IO`, `INVALID_DATA`                                                                                              |
| `save_dump_profile`        | `dump_profiles`         | `profile: DumpProfileInput` (`id: null` creates)                                                     | `DumpProfile`                                                      | `INVALID_INPUT` (name, settings, deleted connection, too many), `NOT_FOUND`, `IO`                                 |
| `delete_dump_profile`      | `dump_profiles`         | `id`                                                                                                 | `null`                                                             | `IO`                                                                                                              |
| `run_dump_profile`         | `dump_profiles`         | `id`                                                                                                 | `JobInfo`                                                          | `NOT_FOUND`, `NOT_CONNECTED`, `INVALID_INPUT`, `IO`                                                               |
| `list_jobs`                | `jobs`                  | none                                                                                                 | `JobInfo[]`                                                        | none                                                                                                              |
| `get_job_log`              | `jobs`                  | `jobId`                                                                                              | `string[]`                                                         | `NOT_FOUND`                                                                                                       |
| `cancel_job`               | `jobs`                  | `jobId`                                                                                              | `null`                                                             | `NOT_FOUND`                                                                                                       |
| `dismiss_job`              | `jobs`                  | `jobId`                                                                                              | `null`                                                             | `NOT_FOUND`, `INVALID_INPUT` (still running)                                                                      |
| `get_settings`             | `settings`              | none                                                                                                 | `Settings`                                                         | `IO`, `INVALID_DATA`                                                                                              |
| `update_settings`          | `settings`              | `settings: Settings`                                                                                 | `Settings`                                                         | `IO`, `INTERNAL`                                                                                                  |
| `list_connections`         | `connections`           | none                                                                                                 | `ConnectionProfile[]`                                              | `IO`, `INVALID_DATA`                                                                                              |
| `save_connection`          | `connections`           | `profile`, `secrets: SecretUpdates`                                                                  | `ConnectionProfile`                                                | `INVALID_INPUT`, `IO`, `KEYCHAIN`                                                                                 |
| `delete_connection`        | `connections`           | `connectionId`                                                                                       | `null`                                                             | `NOT_FOUND`, `IO`, `KEYCHAIN`                                                                                     |
| `duplicate_connection`     | `connections`           | `connectionId`                                                                                       | `ConnectionProfile`                                                | `NOT_FOUND`, `KEYCHAIN`                                                                                           |
| `get_stored_secrets`       | `connections`           | `connectionId`                                                                                       | `StoredSecrets` (booleans only)                                    | `KEYCHAIN`                                                                                                        |
| `parse_connection_string`  | `connections`           | `uri`                                                                                                | `ParsedConnectionString`                                           | `INVALID_INPUT`                                                                                                   |
| `build_connection_string`  | `connections`           | `config`                                                                                             | `string` (no secrets)                                              | none                                                                                                              |
| `test_connection`          | `connections`           | `config`, `connectionId` (nullable), `secrets`                                                       | `ServerInfo`                                                       | `CONNECTION_FAILED`, `AUTH_FAILED`, `SSH_FAILED`, `INVALID_INPUT`, `KEYCHAIN`                                     |
| `open_connection`          | `connections`           | `connectionId`                                                                                       | `ActiveConnectionInfo`                                             | as `test_connection`, `NOT_FOUND`                                                                                 |
| `close_connection`         | `connections`           | `connectionId`                                                                                       | `null`                                                             | none                                                                                                              |
| `list_active_connections`  | `connections`           | none                                                                                                 | `ActiveConnectionInfo[]`                                           | none                                                                                                              |
| `export_connections`       | `connections::transfer` | `path`, `connectionIds`, `password` (nullable)                                                       | `null`                                                             | `IO`                                                                                                              |
| `inspect_connections_file` | `connections::transfer` | `path`                                                                                               | `ConnectionsFileInfo`                                              | `IO`, `INVALID_DATA`                                                                                              |
| `import_connections`       | `connections::transfer` | `path`, `password` (nullable)                                                                        | `ImportSummary`                                                    | `IO`, `INVALID_DATA`, `INVALID_INPUT` (wrong password)                                                            |
| `list_databases`           | `databases`             | `connectionId`                                                                                       | `DatabaseInfo[]`                                                   | `NOT_CONNECTED`, `FORBIDDEN`, `CONNECTION_FAILED`                                                                 |
| `create_database`          | `databases`             | `connectionId`, `database`, `collection`                                                             | `null`                                                             | `INVALID_INPUT`, `FORBIDDEN`, `NOT_CONNECTED`                                                                     |
| `drop_database`            | `databases`             | `connectionId`, `database`                                                                           | `null`                                                             | `FORBIDDEN`, `NOT_CONNECTED`                                                                                      |
| `list_collections`         | `collections`           | `connectionId`, `database`                                                                           | `CollectionInfo[]`                                                 | `FORBIDDEN`, `NOT_CONNECTED`                                                                                      |
| `collection_stats`         | `collections`           | `connectionId`, `database`, `collection`                                                             | `CollectionStats`                                                  | `NOT_FOUND`, `FORBIDDEN`, `NOT_CONNECTED`                                                                         |
| `create_collection`        | `collections`           | `connectionId`, `database`, `collection`, `options: NewCollectionOptions`                            | `null`                                                             | `INVALID_INPUT` (bad options, exists), `FORBIDDEN`, `NOT_CONNECTED`                                               |
| `create_view`              | `collections`           | `connectionId`, `database`, `view: NewView`                                                          | `null`                                                             | `INVALID_INPUT` (pipeline syntax, exists), `FORBIDDEN`, `NOT_CONNECTED`                                           |
| `rename_collection`        | `collections`           | `connectionId`, `database`, `collection`, `newName`                                                  | `null`                                                             | `INVALID_INPUT` (target exists), `NOT_FOUND`, `FORBIDDEN`, `NOT_CONNECTED`                                        |
| `drop_collection`          | `collections`           | `connectionId`, `database`, `collection`                                                             | `null`                                                             | `FORBIDDEN`, `NOT_CONNECTED`                                                                                      |
| `find_documents`           | `documents`             | `connectionId`, `database`, `collection`, `request: FindRequest`                                     | `FindPage` (canonical EJSON strings, `hasMore`)                    | `INVALID_INPUT` (named query part, page size), `TIMEOUT`, `FORBIDDEN`, `NOT_CONNECTED`                            |
| `count_documents`          | `documents`             | `connectionId`, `database`, `collection`, `filter`, `maxTimeMs` (nullable)                           | `DocumentCount`                                                    | `INVALID_INPUT`, `TIMEOUT`, `FORBIDDEN`, `NOT_CONNECTED`                                                          |
| `sample_fields`            | `documents`             | `connectionId`, `database`, `collection`                                                             | `FieldSample` (top-level fields, dotted paths)                     | `TIMEOUT`, `FORBIDDEN`, `NOT_CONNECTED`                                                                           |
| `insert_documents`         | `documents`             | `connectionId`, `database`, `collection`, `text` (one document or an array, shell syntax)            | `number` (inserted)                                                | `INVALID_INPUT` (parse, too many, duplicate key, validation), `FORBIDDEN`, `NOT_CONNECTED`                        |
| `replace_document`         | `documents`             | `connectionId`, `database`, `collection`, `id` (canonical EJSON), `original` (as loaded), `text`     | `null`                                                             | `CONFLICT`, `NOT_FOUND`, `INVALID_INPUT` (parse, changed `_id`, validation), `FORBIDDEN`, `NOT_CONNECTED`         |
| `set_document_field`       | `documents`             | `connectionId`, `database`, `collection`, `edit: FieldEdit` (`id`, `path`, `originalValue`, `value`) | `null`                                                             | `CONFLICT`, `INVALID_INPUT`, `FORBIDDEN`, `NOT_CONNECTED`                                                         |
| `delete_document`          | `documents`             | `connectionId`, `database`, `collection`, `id`                                                       | `null`                                                             | `NOT_FOUND`, `INVALID_INPUT`, `FORBIDDEN`, `NOT_CONNECTED`                                                        |
| `preview_update_many`      | `documents`             | `connectionId`, `database`, `collection`, `filter`, `update`                                         | `UpdatePreview` (`matched`, 3 `samples` before/after, `simulated`) | `INVALID_INPUT` (parse, replacement document, server rejects the update), `TIMEOUT`, `FORBIDDEN`, `NOT_CONNECTED` |
| `update_many`              | `documents`             | `connectionId`, `database`, `collection`, `filter`, `update`                                         | `UpdateSummary` (`matched`, `modified`)                            | as `preview_update_many`                                                                                          |
| `preview_delete_many`      | `documents`             | `connectionId`, `database`, `collection`, `filter`                                                   | `DeletePreview` (`matched`, 3 `samples`)                           | `INVALID_INPUT`, `TIMEOUT`, `FORBIDDEN`, `NOT_CONNECTED`                                                          |
| `delete_many`              | `documents`             | `connectionId`, `database`, `collection`, `filter`                                                   | `number` (deleted)                                                 | `INVALID_INPUT`, `FORBIDDEN`, `NOT_CONNECTED`                                                                     |
| `list_queries`             | `query_history`         | `connectionId`, `database`, `collection`                                                             | `CollectionQueries`                                                | `IO`, `INVALID_DATA`                                                                                              |
| `record_query`             | `query_history`         | `connectionId`, `database`, `collection`, `query: QueryParts`                                        | `CollectionQueries`                                                | `IO`                                                                                                              |
| `save_favorite_query`      | `query_history`         | `connectionId`, `database`, `collection`, `name`, `query`                                            | `CollectionQueries`                                                | `INVALID_INPUT` (no name, empty query, too many), `IO`                                                            |
| `delete_favorite_query`    | `query_history`         | `connectionId`, `database`, `collection`, `id`                                                       | `CollectionQueries`                                                | `IO`                                                                                                              |

Plugin permissions: `dialog:allow-open`, `dialog:allow-save` (native file pickers; the chosen
path is passed to the commands above).

## Events

Typed `tauri-specta` events, registered with `collect_events!` in `ipc.rs` and exposed as
`events.<name>.listen(...)` in `bindings.ts`:

| Event        | Payload                      | When                                                 |
| ------------ | ---------------------------- | ---------------------------------------------------- |
| `JobUpdated` | `{ job: JobInfo }`           | A job starts, changes (at most every 200 ms) or ends |
| `JobLogged`  | `{ jobId, lines: string[] }` | New output lines of a job, batched like `JobUpdated` |

The frontend subscribes once (`useJobEvents`); see [background-jobs.md](background-jobs.md).

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
| `NOT_FOUND`         | The requested connection, database, collection or document does not exist              |
| `CONFLICT`          | The data changed since it was loaded; nothing was written (reload and try again)       |
| `KEYCHAIN`          | The OS keychain is unavailable or refused access                                       |
| `CONNECTION_FAILED` | The server could not be reached or selected (including DNS/SRV)                        |
| `AUTH_FAILED`       | The server rejected the credentials                                                    |
| `SSH_FAILED`        | The SSH tunnel could not be established                                                |
| `NOT_CONNECTED`     | The connection is not open; connect first                                              |
| `FORBIDDEN`         | The server refused the operation for this user (missing privileges)                    |
| `TIMEOUT`           | The operation exceeded its time limit (`maxTimeMS`)                                    |
| `OPERATION_FAILED`  | The server rejected the operation for another reason; the message has its explanation  |
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
