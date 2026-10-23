# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project
adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Project scaffold: Tauri 2 + React 19 + TypeScript (strict) + Vite + Tailwind CSS 4.
- Typed IPC layer: Rust commands exported to TypeScript with tauri-specta; a single
  `AppError { code, message, hint }` error model; `unwrap`/`call` client helpers.
- Strict Tauri capabilities: each app command must be allow-listed explicitly.
- Settings persisted as JSON in the platform config directory (atomic writes).
- App shell: resizable sidebar, tab bar (keyboard navigable), status bar.
- Light / dark / system theme, persisted and following OS changes live.
- Command palette (Ctrl/Cmd+K) and tab shortcuts (close, next, previous).
- About dialog with version and platform.
- Tooling: ESLint (type-aware, a11y, max 300 lines per file), Prettier, rustfmt, clippy
  (`-D warnings`, no `unwrap`), husky pre-commit hook, commitlint (Conventional Commits).
- CI workflow: lint, type-check and tests on Linux, Windows and macOS.
- Documentation: `CLAUDE.md`, `docs/` skeleton and ADRs 0001–0007.
- Connections (milestone 2):
  - saved connections with folders, favorites and color labels; create, edit, duplicate, delete;
  - connection string and form kept in sync both ways (`mongodb://` and `mongodb+srv://`);
  - authentication: SCRAM-SHA-1/256, X.509, LDAP (PLAIN), AWS IAM, OIDC environment providers;
  - TLS with CA file, client certificate/key (optionally encrypted) and relaxed verification;
  - SSH tunnels with password or private key, known_hosts verification (trust on first use);
  - test connection, connect/disconnect, several live connections at once;
  - connection overview tab with server version, topology and members;
  - import/export of connections, optionally with passwords encrypted by a password;
  - command-palette and welcome-screen actions for connections.
- Integration tests against MongoDB 8 in Docker (testcontainers).
- ADR 0008 (encrypted connection export) and ADR 0013 (SSH tunnels); `docs/roadmap.md`.
- Databases and collections (milestone 3):
  - sidebar tree under each connected connection: databases with sizes, collections and views
    with document counts; expands automatically after connecting;
  - create databases (with their first collection), standard, capped and time-series
    collections, and views from an aggregation pipeline; rename collections;
  - drop databases, collections and views after typing the exact name (confirm-by-typing);
  - collection tab with document count, data, storage and index sizes;
  - clear errors for missing privileges, existing names, invalid names and timeouts.
- Documents (milestone 3): paged loading (10–1000 per page, never the whole collection) with
  list (expandable, type-colored), JSON (mongosh syntax) and virtualized table views; exact
  BSON types preserved end to end (Int64, Decimal128, dates, UUIDs, …); copy a document;
  ADR 0011 (paging) and ADR 0012 (Extended JSON).
- Query bar (milestone 3): filter, projection, sort, collation, skip, limit and time limit in
  mongosh syntax; autocomplete for field names, operators and value constructors; errors
  shown next to the query; recent queries and named favorites per collection.
- Editing documents (milestone 3): insert one or many documents, edit a whole document or a
  single field inline, clone and delete, in a built-in code editor (Monaco, loaded on demand,
  with shell-syntax highlighting and error markers); refused on views and read-only
  collections; a document changed by someone else since it was loaded is never overwritten.
- Bulk update and delete (milestone 3): change or delete every document matching a filter, with
  a preview of the match count and sample documents (before and after on replica sets) and a
  confirmation by typing the collection name.
- Query parsing in the backend: JSON, Extended JSON and mongosh syntax (`ObjectId(…)`,
  `ISODate(…)`, unquoted keys, `/regex/`, `NumberLong(…)`, …) with line/column errors.
- End-user guide in `docs/user-guide/`.
- Integration tests through a real OpenSSH server and against a replica set.
- Bundled MongoDB Database Tools 100.19.1 (`mongodump`, `mongorestore`, `mongoexport`,
  `mongoimport`) for Windows, macOS and Linux, fetched by `pnpm sidecars` with SHA-256
  verification and listed with their version in the About dialog (milestone 4); ADR 0009.
- Dump (milestone 4): back up a whole server, a database or a collection from the sidebar into
  a folder or a single archive file, optionally gzip-compressed, with the bundled `mongodump`.
  Options per scope: a query filter for a collection (same syntax as the documents filter),
  ticking which collections of a database to include plus name prefixes to leave out, a
  point-in-time oplog snapshot of a whole replica set, and how many collections run at a time.
- Restore (milestone 4): "Restore…" in a connected connection's ⋯ menu loads a dump folder or
  archive (gzip detected) with the bundled `mongorestore`. RipeMongo reads the dump first and
  lists its databases and collections to tick, with a new name per database, drop before
  restore (confirmed by typing the connection name), dry run, oplog replay for point-in-time
  dumps and collections at a time; the summary counts restored and failed documents.
- Saved dumps (milestone 4): save a dump's settings under a name and run it again with one
  click from "Saved dumps" (command palette or the connection's ⋯ menu); RipeMongo connects
  first if needed. Edit and delete them there; deleting a connection deletes its saved dumps.
- Background jobs (milestone 4): dumps run in the background with live progress, cancel, a
  summary or readable error at the end, the full tool log and the equivalent command (both
  copyable); a Jobs button in the status bar and a toast when a job ends; ADR 0010.

### Security

- Connection secrets are stored only in the OS keychain and never sent back to the webview;
  connection strings are redacted in logs and error messages.
- The bundled tools receive credentials in a private temporary file, never on the command line.

### Not yet implemented

- Interactive browser OIDC sign-in and Kerberos (GSSAPI) authentication.

<!-- The first release will be tagged 0.1.0. -->
