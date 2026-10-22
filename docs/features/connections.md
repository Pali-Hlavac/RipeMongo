# Connections

## What it does

- Save connections with a name, optional **folder**, **color label** and **favorite** flag. The
  sidebar shows Favorites, then folders, then the rest, each with a live status dot.
- Create, edit, **duplicate** (secrets included) and delete connections from the sidebar "⋯" menu,
  the command palette or the welcome tab.
- Edit settings either as a **connection string** or in the form; both stay in sync. Pasting a
  URI with a password moves the password into the keychain-backed password field.
- Authentication: SCRAM (SHA-1/SHA-256/auto), X.509, LDAP (PLAIN), AWS IAM (keys or
  environment), OIDC machine workflow (Azure, GCP, Kubernetes). Interactive browser OIDC
  sign-in and Kerberos (GSSAPI) are not supported yet.
- TLS: on/off/default, CA file, client certificate + key (optionally password protected),
  allow invalid certificates / host names (with a warning).
- SSH tunnel: password or private key (+ passphrase), host-key verification (ADR 0013).
- **Test connection** before saving; **Save & connect**; connect/disconnect; several
  connections can be open at once. Each connection has an overview tab with server version,
  topology, members and the connection string (password never shown).
- **Import/export** connections as a JSON file, optionally including passwords encrypted with
  a password (ADR 0008).

## How it works

```
Sidebar / Editor / Overview (src/features/connections/components)
  → api/{profiles,session,transfer}.ts (TanStack Query, typed IPC)
  → connections::commands / connections::transfer::commands
  → ConnectionManager (service.rs)
      ├─ ConnectionRepository → connections.json (storage::JsonFile, atomic writes)
      ├─ SecretStore (keyring) → OS keychain, key "connection/<id>/<secret>"
      ├─ uri::{parse,build}  (no DNS; unknown options preserved)
      ├─ client::open_client → [SshTunnel] → mongodb::Client (ClientOptions::parse does SRV)
      └─ ConnectionRegistry  (live clients by id; closed on disconnect/delete)
```

- **Secrets never return to the webview.** The UI receives only `StoredSecrets` booleans and
  sends `SecretUpdates` (`keep` / `set` / `clear`) when saving or testing.
- **URI sync** (`hooks/useUriSync.ts`): form changes call `build_connection_string` (without
  secrets); URI edits are parsed 300 ms after typing stops via `parse_connection_string`. The
  URI field is not overwritten while focused; on blur it shows the normalized form. The SSH
  tunnel is not part of URIs, so parsing keeps the form's SSH settings.
- **Status**: "connected" comes from `list_active_connections`; "connecting" and the last
  connect error live in `store/status.ts` (frontend only).
- Defaults when not set by the user: `serverSelectionTimeoutMS` 10 s, `connectTimeoutMS` 10 s,
  `appName` "RipeMongo".
- Driver errors are mapped to `AUTH_FAILED`, `CONNECTION_FAILED` or `INVALID_INPUT` with
  hints, and any URI inside a message is redacted (`uri/redact.rs`).

## Key files

| Path                                                                   | Responsibility                                  |
| ---------------------------------------------------------------------- | ----------------------------------------------- |
| `src-tauri/src/connections/config.rs`, `types.rs`                      | Data model (config, profile, colors)            |
| `src-tauri/src/connections/uri/`                                       | Parse/build/redact connection strings           |
| `src-tauri/src/connections/secrets.rs`                                 | Keychain keys, `SecretUpdates`, `StoredSecrets` |
| `src-tauri/src/connections/service.rs`                                 | `ConnectionManager` use cases                   |
| `src-tauri/src/connections/client.rs`, `registry.rs`, `server_info.rs` | Live clients                                    |
| `src-tauri/src/connections/transfer/`                                  | Import/export and encryption                    |
| `src-tauri/src/ssh/`                                                   | SSH tunnel and host-key verification            |
| `src-tauri/src/secrets/`                                               | Keychain and in-memory secret stores            |
| `src/features/connections/components/`                                 | Sidebar, editor, overview, transfer dialogs     |
| `src/features/connections/hooks/`                                      | Draft state, URI sync, status, palette commands |

## Edge cases and limitations

- SSH tunnels support one non-SRV host and force a direct connection (no failover).
- Linux without a Secret Service provider cannot store passwords; the error explains how to
  install one. Connections without passwords still work.
- Deleting a connection only removes local settings and keychain entries, never server data.
- Importing the same file twice creates duplicates.
- Database browsing starts in milestone 3; the overview tab says so.

## How to test

- Rust unit tests: `pnpm test:rust` (URI parsing/building/redaction, secrets, repository,
  validation, transfer encryption).
- Integration tests (Docker required): `cargo test --manifest-path src-tauri/Cargo.toml --test connections`
  — MongoDB 8 without auth, with SCRAM auth (right and wrong password), unreachable server.
- Frontend: `pnpm test` (sidebar grouping/status, editor URI sync and save, secret field,
  helpers).
- Manual: `docker run --rm -p 27027:27017 -e MONGO_INITDB_ROOT_USERNAME=root -e MONGO_INITDB_ROOT_PASSWORD=secret mongo:8.0`,
  then in the app: New connection → paste `mongodb://root:secret@localhost:27027/?authSource=admin`
  → Test → Save & connect.
