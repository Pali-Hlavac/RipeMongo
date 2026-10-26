# Roadmap and plan

This is the approved delivery plan for RipeMongo (agreed 2026-10-22). The original
requirements are in [project-brief.md](project-brief.md); where this plan differs, this plan
wins. Every milestone ends with a runnable, tested app, updated docs and a CHANGELOG entry.

Legend: `[x]` done · `[ ]` to do · `[~]` partially done / deferred (see note)

## Agreed product decisions

| Decision        | Detail                                                                                                                                                        |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Name            | **RipeMongo** (replaces the brief's working name "Mongo Studio"). Defined in `src/app.config.ts` + `tauri.conf.json` (`productName`), kept in sync by a test. |
| Bundled tools   | mongo-tools are **always bundled** as sidecars, even if the installer grows past ~40 MB. User convenience is the #1 priority.                                 |
| Type generation | `tauri-specta` (fallback `ts-rs`) — ADR 0003.                                                                                                                 |
| E2E tests       | WebdriverIO + `tauri-driver` on Linux/Windows; no macOS E2E (no WKWebView driver).                                                                            |
| SSH tunnels     | Forward to a single host and force `directConnection=true`; no SRV over SSH.                                                                                  |
| Monaco          | Bundled locally (no CDN), lazy-loaded.                                                                                                                        |
| mongosh         | Not ported in v1; a `runCommand` console instead (ADR 0014).                                                                                                  |

## Milestones

### M1 — Scaffold, tooling, CI, docs ✅

- [x] Tauri 2 + React + TS strict + Vite + Tailwind 4 + shadcn/ui primitives
- [x] Typed IPC (tauri-specta), `AppError` model, strict capabilities
- [x] App shell: resizable sidebar, tabs, status bar, command palette, theme, About
- [x] ESLint/Prettier/rustfmt/clippy, file-size check, husky + lint-staged + commitlint
- [x] CI workflow (lint, types, tests on Linux/Windows/macOS)
- [x] `CLAUDE.md`, docs skeleton, ADRs 0001–0007, CHANGELOG

### M2 — Connections ✅

- [x] Saved connections: create, edit, duplicate, delete
- [x] Folders/groups, favorites, color labels
- [x] Connection string ⇄ structured form, two-way sync (host/port, `mongodb+srv`, auth, TLS, replica set, read preference)
- [x] Auth: SCRAM-SHA-1/256, X.509, LDAP (PLAIN), AWS IAM, OIDC (environment providers; browser flow documented as unsupported)
- [x] TLS: CA file, client certificate/key (+ key password), allow invalid certs/hostnames
- [x] SSH tunnel: password and private key with passphrase, host-key verification — verified against a real OpenSSH server in M3 (`tests/ssh_tunnel.rs`)
- [x] Secrets in the OS keychain only; redaction of connection strings in logs/errors
- [x] Test connection; connect / disconnect; multiple simultaneous connections
- [x] Connection overview tab (server version, topology, hosts)
- [x] Import/export connections: without secrets, or encrypted with a password
- [x] Integration tests with testcontainers (MongoDB 8 with SCRAM auth)
- [x] ADRs 0008 (encrypted export), 0013 (SSH tunnels); docs/features/connections.md

Verified end to end in the app (2026-10-22) against MongoDB 8.0 in Docker: paste URI with
password → test → save & connect → overview → edit shows "saved in keychain" → delete removes
the keychain entry; export with an encrypted password through the native save dialog →
delete → import (wrong password rejected inline, right password restores the keychain entry).

### M3 — Browsing, documents, query bar ✅

- [x] Sidebar tree: databases, collections, views with counts and sizes
- [x] Create/drop databases, collections, views, capped and time-series collections; rename collections
- [x] Confirm-by-typing dialog for destructive actions
- [x] Documents: list (JSON tree), JSON and virtualized table views
- [x] Query bar: filter, project, sort, collation, skip, limit, maxTimeMS; field/operator autocomplete
- [x] Shell-style query syntax (`{_id: ObjectId("…")}`, `ISODate(…)`, unquoted keys, `/regex/`)
- [x] Query history and favorite queries per collection
- [x] Insert, edit (inline + Monaco JSON editor), clone, delete
- [x] Bulk update/delete with preview + confirmation
- [x] Full BSON/Extended JSON support (ObjectId, Date, Decimal128, Long, Binary, UUID, Regex, …)
- [x] Paged loading; never load a whole collection
- [x] Replica-set integration tests; SSH tunnel test against a real sshd (carried over from M2)
- [x] ADRs 0011 (paging), 0012 (Extended JSON); feature docs; user guide pages

Slices, in order: (1) database/collection admin backend + sidebar tree + dialogs;
(2) Extended JSON + shell-syntax parser; (3) find with paging + document views;
(4) query bar with autocomplete, history, favorites; (5) CRUD + Monaco editor;
(6) bulk update/delete with preview; (7) integration tests, docs, user guide, verification.

#### Where we left off (2026-10-22)

**Done and committed**

- Slice 2: `src-tauri/src/ejson/` parses JSON, Extended JSON and mongosh syntax with
  line/column errors; `to_canonical_json` is the lossless output format for documents.
  `serde_json` has `preserve_order` (field order matters).
- Slice 1 complete: backend `mongo/`, `databases/`, `collections/` (+ `tests/catalog.rs`);
  frontend feature `src/features/catalog/` (tree under connected connections, create/rename/
  drop dialogs, `CollectionHeader`), `ConfirmByTypingDialog`, `InlineError`, tabs store
  `replaceTab`. Collection tabs render `src/app/layout/CollectionTabView.tsx` (header + a
  labelled "document browsing is coming" placeholder). Docs: `docs/features/navigation.md`,
  user guide `databases-and-collections.md`.

- Slice 3 complete: backend `documents/` (`find_documents` with skip/limit + 1 and
  maxTimeMS, `count_documents`; `tests/documents.rs`), ADRs 0011 and 0012, frontend feature
  `src/features/documents/` (ordered EJSON reader, typed `BsonValue`, `toShell` round-trip
  tested against the Rust parser, list/JSON/virtualized table views, pager, per-tab view
  store). TanStack Table is **v9** (`useTable`, `tableFeatures`, `table.FlexRender`).

- Slice 4 complete: query bar (`documents/components/query/`: filter + options incl.
  skip/limit/max time, combobox autocomplete from `lib/completion.ts`, inline errors), backend
  `query_history/` (recent + favorites in `query-history.json`, 4 commands), per-tab applied
  query in `store/view.ts`, `FormDialog` moved to `shared/components`.

- Slice 5 complete: backend `documents/writes.rs` (`insert_documents`, `replace_document`
  and `set_document_field` with optimistic conflict checks → `CONFLICT`, `delete_document`;
  `tests/document_writes.rs`), `shared/editor/` (lazy Monaco core with a local worker and a
  Monarch `mongosh` language), `documents/components/actions/` (provider + context, editor
  dialog, card buttons), inline field edit in the list view, table row double-click. Writes
  are hidden on views/read-only collections; whole-document edit/clone is disabled while a
  projection is applied. Verified in the real app (2026-10-22): edit with Ctrl+Enter,
  conflict after an external change, parse-error marker, insert of an array, clone without
  `_id`, inline edit, delete, table row double-click, no write actions on a view. Found and
  fixed there: Monaco crashed under `freezePrototype` (now patched, guarded in `pnpm lint`).

- Slice 6 complete: `documents/bulk.rs` (`preview_update_many`, `update_many`,
  `preview_delete_many`, `delete_many`; update preview simulated in an aborted transaction on
  replica sets, count + current documents on standalone), `tests/bulk_writes.rs` (standalone and
  single-node replica set via `common::start_replica_set`), frontend `components/bulk/`
  (Bulk menu, dialogs, preview samples, confirm-by-typing). Verified in the real app
  (2026-10-22, single-node replica set): before/after preview with nothing written, stale
  preview blocks the update, server error (`$inc` on a string) shown in the preview, update of 8
  and delete of 4 after typing the collection name. Fixed: "Delete no documents" button label.

- Slice 7 complete: `tests/replica_set.rs` (topology, catalog, paging, edits on
  `start_replica_set`), `tests/ssh_tunnel.rs` (real OpenSSH container, MongoDB only on a private
  Docker network: password, generated private key, wrong password, changed host key), docs pass
  (ADR 0013 consequences, navigation doc, user guide note on direct connections).

**Milestone 3 is complete.**

Verified in the real app (2026-10-22, MongoDB 8 in Docker, 120 nested sample documents): list,
JSON and table views, paging, filter with field suggestions, sort, inline query errors, history
and favorites. Fixed afterwards: colon spacing, dimmer placeholders, no pager range on errors,
favorite summary wrapping, and history removal when a connection is deleted.

### M4 — Tools: dump, restore, import, export, copy

- [x] Sidecar fetch script (pinned version, SHA-256 verification), bundling for all 4 targets (installers built and checked on Windows; macOS/Linux packages come with the M8 release workflow)
- [x] Background job registry: progress events, cancel, logs — ADR 0010
- [x] Dump UI: server / databases / collections, query filter, gzip, archive, oplog, include/exclude, parallelism (mongodump has no database exclusion: include/exclude is per database)
- [x] Restore UI: drop before restore, `nsFrom`/`nsTo`, dry run (plus include/exclude, oplog replay; renames per database)
- [x] Live progress, cancel, readable errors, copyable log, equivalent CLI command
- [x] Saved dump profiles (one-click re-run, connects first)
- [x] JSON/CSV import and export per collection with field selection and type mapping (CSV/TSV with any delimiter read by RipeMongo and piped to mongoimport)
- [x] Import speed options: parallel insert workers (`--numInsertionWorkers`, 1–16) and "Skip validation rules" (`--bypassDocumentValidation`, with a warning)
- [x] Large-file import test (a generated JSON and CSV file of several GB, not committed): progress, cancel and memory use stay flat; the same file imported with 1 and with several insert workers, both times recorded in `docs/development/testing.md` (opt-in, not in CI)
- [x] Copy collection/database between connections (also within one connection under another name)
- [x] Measure installer size — ADR 0009 (Windows, with the tools: NSIS 21.4 MiB, MSI 28.6 MiB)

Slices, in order: (1) sidecar fetch script, lock file, bundling config and the `tools` module
that finds the binaries (tools version in About), ADR 0009; (2) job registry with progress and
log events, cancel, jobs panel, process runner, plus a basic dump (server / database /
collection to a folder or archive) as its first job, ADR 0010; (3) all dump options and saved
dump profiles; (4) restore; (5) JSON/CSV export and import with field selection and type
mapping; (6) copy a collection or database between connections (dump piped into restore);
(7) installer size, docs pass, user guide, verification in the real app.

Decisions for M4 (details in ADRs 0009 and 0010 as they are written):

- Tools version **100.19.1** (latest on 2026-10-22). Linux uses the `ubuntu2204` build, the
  same baseline the Linux installers are built on.
- `externalBin` lives in `src-tauri/tauri.sidecars.conf.json`, merged only by `pnpm app:build`,
  so `cargo build`/`test`/`clippy` work without downloaded binaries. Debug builds fall back to
  `src-tauri/binaries/<tool>-<target>`; release builds look next to the app executable.
- Credentials reach the tools through a temporary `--config` file readable only by the user,
  never on the command line (visible to other processes). The displayed CLI command is redacted.
- Tools connect through the app's existing SSH tunnel when the connection uses one, so a
  connection must be open to run a tool job.
- Job state is server data: the frontend keeps it in TanStack Query and patches the cache
  from events (instead of the Zustand store the first design note sketched).

#### Where we left off (M4)

- Slice 1 complete: `scripts/fetch-sidecars.mjs` + `sidecars.lock.json` (100.19.1, four
  targets, checksums cross-checked with MongoDB's feed), pure-Node archive readers with tests,
  `src-tauri/tauri.sidecars.conf.json` merged by `pnpm app:build`, `tools` module (`locate`,
  `tool_command`, `get_tools_info`), About shows the tools version, CI fetches the tools,
  ADR 0009. `pnpm app:build` verified on Windows: the tools and licenses land next to
  `ripemongo.exe`; NSIS 21.4 MiB, MSI 28.6 MiB.
- Slice 2 complete: `jobs` module (registry, throttled `JobUpdated`/`JobLogged` events,
  commands, tests), `tools/run.rs` (log, progress parser, cancel → kill, `Failed:` → error),
  credentials in a temp `--config` file, `ConnectionManager::tool_connection` (keeps the SSH
  tunnel open), `tools/dump/` + `start_dump`, `tests/dump.rs` (SCRAM auth, folder, gzip
  archive, failure). Frontend `features/jobs` (events → TanStack Query, status-bar button,
  panel, log dialog) and `features/tools` (dump dialog from the sidebar menus). ADR 0010,
  user guide `backups.md`, feature doc `tools.md`.
- Verified in the real app (2026-10-23, MongoDB 8 in Docker with 10 million documents): native
  folder picker, folder and gzip archive dumps of a collection, database and the whole server,
  live progress bar with totals, Cancel (process killed, temp config file deleted), toasts, log
  and equivalent command. Fixed there: namespaces quoted with backticks by tools 100.19 were
  counted twice next to the progress bars; doubled backslashes in the displayed command; the
  jobs panel sometimes closed right after opening (focus returning to the sidebar); the label
  now names the collection still in progress; Monaco pre-bundled by Vite.
- Slice 3 complete: `DumpRequest` options with scope rules (`tools/dump/args.rs`: query parsed
  like the documents filter and passed as canonical Extended JSON, `--oplog` for whole-server
  dumps, `--excludeCollection` from a collection checklist plus prefixes, 1–16 collections in
  parallel), oplog lines in progress and summary, JSON queries single-quoted in the displayed
  command. `dump_profiles` module (`dump-profiles.json`, 4 commands, removed with their
  connection), Saved dumps dialog (run connects first via `useEnsureConnected` passed in by
  the app, edit, delete), "Save for one-click re-runs" in the dump dialog, palette and
  connection-menu entries. `useAfterDialogClose` (shared) replaces the jobs-panel focus fix
  and also fixes the palette opening dialogs. Integration tests: prefix exclusion,
  parallelism, query into gzip archive, oplog dump of a replica set.
- Slice 4 complete: `tools/restore/` (`inspect_dump` reads folder layouts and archive
  preludes, through gzip; `RestoreRequest` with escaped `--nsExclude`, per-database
  `--nsFrom/--nsTo`, drop, dry run with `--verbose=1`, oplog replay only for a full restore;
  `RestoreProgress`), `inspect_dump` + `start_restore` commands, `tests/restore.rs` (real
  dumps read back, rename + exclude, duplicates, drop, dry run, oplog replay). Frontend
  `RestoreDialog` (connection ⋯ → "Restore…", contents checklist with "restore as",
  confirm-by-typing for drop). Found while probing mongorestore 100.19: `--oplogReplay`
  refuses includes, excludes and renames; `admin.system.version` is always skipped.
- Verified in the real app (2026-10-23, MongoDB 8 replica set in Docker, 2 million
  documents): database dump with unticked collection, prefix, gzip and 2 at a time saved as
  "Nightly shop"; Saved dumps from the palette; Edit and Run while disconnected (connects
  first); whole-server oplog dump to a gzip archive; restore of a folder as `shop_copy`
  without one collection; the "folder of one database" hint; dry run with a rename (oplog
  replay switches off with its reason); drop and restore with oplog replay behind typing the
  connection name; deleting the connection removes its saved dump. Fixed there: buttons of
  the dump and restore dialogs scrolled out of view (fixed footer now); folder restores now
  show bytes read of the total instead of a count that stood at 0; dry-run summaries counted
  `.oplog` and `admin.system.version`; "Replayed 0 oplog entries" wording; partly selected
  databases showed an empty checkbox; prefix-matched collections looked included; the sidebar
  now reloads after a restore; tab shortcuts (Ctrl+Tab, Ctrl+W) no longer act behind open
  dialogs; the delete-connection text mentions saved queries and dumps.
- Slice 5a complete: export. `documents/fields.rs` (`sample_fields`: top-level fields and
  dotted paths from `$sample` of 1,000), `tools/export/` (`ExportRequest` → `mongoexport`
  arguments, `ExportProgress`), `start_export`, `tests/export.rs`. Frontend `ExportDialog`
  (format, file, field checklist, JSON/CSV options, query) from the collection ⋯ menu and the
  documents toolbar (carries the applied query); `SegmentedField` and `PathField` shared with
  the dump dialog. Found while probing mongoexport 100.19: `--sort` refuses canonical Extended
  JSON (`$numberInt`), JSON exports keep whole top-level fields for dotted names, missing
  folders are created.
- Slice 5b complete: import. `tools/import/` (`preview.rs` detects JSON, JSON arrays and
  delimited text with its delimiter, columns, samples and suggested types from `columns.rs`;
  `feed.rs` rewrites text as plain CSV without header, BOM or left-out columns;
  `request.rs` builds typed `--fields`, parse grace, modes, drop; `ImportProgress` in file
  bytes), `run_tool` can feed stdin (`Input`, `SyncIoBridge`), `inspect_import_file` +
  `start_import`, `tests/import.rs`. Frontend `ImportDialog` (file, new collection name,
  delimiter, header, column mapping, options, drop confirmed by typing) from the collection
  and database menus and the documents toolbar; the catalog and documents reload after an
  import. Found while probing mongoimport 100.19: `auto()` turns `01234` into 1234 and leaves
  `true` and dates as strings, `date_ms` cannot parse a literal `T` (ISO dates use
  `date_go`), stdin imports report only bytes consumed.
- Verified in the real app (2026-10-26, MongoDB 8 in Docker): CSV export from the collection
  menu with a non-ASCII filter, descending sort, limit, nested columns and `_id` left out;
  toolbar export carrying the tab's applied filter into an indented JSON array without one
  field; import of a semicolon CSV with a byte order mark into a new collection (name from
  the file, suggested Text/date/true-false types, a renamed nested field, Decimal128, a
  column left out); merge of a JSON file on `email` (the open tab and sidebar reloaded);
  drop and import behind typing the collection name, with a type failure reported in
  mongoimport's words. Fixed there: the column list scrolled inside the scrolling import
  dialog (about four columns visible) and sat after the value options; it now follows the
  delimiter and header line and the dialog scrolls once.
- Slice 6 complete: copy. `tools/pipe.rs` (`run_pipe`: two tools, stdout → stdin, both logs,
  the tool that stopped first is blamed), `tools/copy/` (`CopyRequest` → arguments of both
  tools, renames via `--nsFrom/--nsTo`, `--drop`, `--noIndexRestore`; `ensure_different`
  compares collection UUIDs so a copy onto itself is refused even through another saved
  connection; `CopyProgress`), `tools/names.rs` shared with restore and import, `start_copy`,
  `tests/copy.rs`. Frontend `CopyDialog` (target connection connected on start, names,
  query or collection checklist, indexes, replace confirmed by typing) from the database and
  collection menus. Found while probing: the tools print their connection string with the
  password when they cannot connect (now masked in every job, commit `14a31bb`); when
  mongorestore cannot connect it fails without a `Failed:` line and mongodump then reports a
  broken pipe.
- Verified in the real app (2026-10-26, MongoDB 8 in Docker: a source without auth with
  300,000 orders, a target with a password): a collection copy with a non-ASCII query into the
  target connection, which was connected on start (20,000 documents, both indexes); a
  database copy without one collection and with replace, confirmed by typing (orders
  replaced, the view and a unique index came along, an unrelated collection in the target
  stayed); a copy within the source as `customers_backup`, after the form refused the
  source's own name; a copy into a paused target failed naming mongorestore, with the
  password masked in the message and the log. Fixed there: the check for copying onto itself
  waited 30 seconds for an unreachable target before anything happened (now at most 5
  seconds; with replace it then refuses); the replace confirmation now names the target
  connection (both sides had a `shop`); the log dialog of a copy speaks of both tools.
- Import speed options and large-file test complete: `ImportRequest` gained
  `insertion_workers` (1–16, `--numInsertionWorkers`) and `bypass_validation`
  (`--bypassDocumentValidation`), shown under "Insert workers" and "Skip validation rules" (a
  warning appears when ticked); `tests/import.rs` imports into a collection with validation
  rules with and without skipping them and a 20,000-row file with 4 workers. The opt-in
  `tests/import_large.rs` (3 GB JSON, 2.5 GB CSV, 9.6 million documents) showed 8 workers
  about twice as fast as one (JSON 203 s → 94 s, CSV 170 s → 90 s), no memory growth in
  RipeMongo, mongoimport under 60 MiB, and a cancel that ended in 0.3 s; results in
  `docs/development/testing.md`.
- Next: slice 7 (docs pass, verification).

### M4.5 — Search and navigation

- [ ] Sidebar filter box (Ctrl/Cmd+Shift+F): fuzzy-matches connections, databases, collections and views; highlights matches, auto-expands parents, hides non-matching branches; keyboard navigation (↑/↓, Enter opens, Esc clears); "db.coll" syntax narrows by database
- [ ] Filter covers only loaded names; databases of connected connections are loaded for it (with a cap and a "N more not searched" hint on very large servers)
- [ ] Command palette "Go to collection…": jump to any collection/view across all connected connections, recently opened first
- [ ] Search/filter in the connection list (name, host, folder, color label)
- [ ] Find in document views (Ctrl/Cmd+F): highlight keys/values on the current page, next/previous match — clearly labelled as page-only, not a database query
- [ ] Tests, docs/features/search.md, user guide page, CHANGELOG

### M5 — Aggregation

- [ ] Visual stage builder: add, drag-and-drop reorder, enable/disable, delete
- [ ] Per-stage sample output preview
- [ ] Text mode synced with the builder; stage templates; operator autocomplete
- [ ] Save pipelines; create view from pipeline
- [ ] Export to JS, Python, Java, C#, Go, Rust — ADR 0016
- [ ] Export find queries (filter, projection, sort, collation, skip, limit) to the same languages,
      sharing the pipeline code generator (from the query bar)

### M6 — Indexes, explain, validation

- [ ] Index list with size and usage stats
- [ ] Create single, compound, text, geo, TTL, partial, unique, hidden, wildcard; drop; hide/unhide
- [ ] Explain plan: visual tree + raw, COLLSCAN / index highlighting
- [ ] Validation: JSON Schema editor, level/action, test against sample documents

### M7 — Schema and performance

- [ ] Schema analysis on a sample (background job): types, frequencies, value distributions, charts
- [ ] Performance dashboard: ops/sec, connections, network, memory, slow ops; kill operations

### M8 — Console, polish, release

- [ ] `runCommand` / admin command console with results in the shared viewers — ADR 0014
- [ ] Keyboard shortcuts everywhere; accessibility pass (focus, ARIA, contrast)
- [ ] Remember window size, open tabs and last connection
- [ ] Settings page: date display timezone (UTC / local, applied in all document views and the
      shell syntax tooltip), default page size and view, default max time, connect timeout
- [ ] E2E smoke tests: connect, query, edit document, dump/restore — ADR 0015
- [ ] Release workflow: build, sign, notarize installers for all platforms with sidecars
- [ ] Auto-update with the Tauri updater plugin (signed update manifests from the release
      workflow, "Check for updates" in the palette and About, release notes from CHANGELOG) — ADR 0017
- [ ] `docs/development/release.md` finalized

### M9 — Safety and everyday productivity

Safety:

- [ ] Per-connection **production** and **read-only** modes. Read-only blocks every write, drop,
      import and restore in the backend (one guard in Rust, not just hidden buttons); production
      asks for confirm-by-typing on every write. A colored window border and a badge in the tab
      and status bar show the mode — ADR 0018
- [ ] Bulk update/delete: "Back up the matching documents first" exports them to a file (export
      job) before writing; on by default for production connections
- [ ] Local write log: single-document edits, inline edits and deletes store the document as it
      was; a "Recent changes" panel can revert one (with the same conflict check as edits) — ADR 0019

Saved dumps:

- [ ] Destination name templates (`{connection}`, `{db}`, `{date}`, `{time}`) so re-runs no
      longer overwrite the previous dump
- [ ] Retention: keep only the last N dumps of a saved dump
- [ ] Schedules (daily, weekly, at a time); in-app scheduler vs. the OS task scheduler decided in
      ADR 0020; missed runs reported on the next start

Connections:

- [ ] Import connections from MongoDB Compass exports (plus Studio 3T and NoSQLBooster if their
      formats allow); passwords go straight to the keychain

Documents:

- [ ] Value context menu: Filter by this value, Exclude this value, Copy value, Copy field path
- [ ] Field operations in the list view: rename, remove and add a field (with conflict checks)
- [ ] Table view: columns for nested paths (expand a column), hide/reorder columns (remembered
      per collection), inline cell editing, multi-select rows → delete, export, copy as JSON/CSV
- [ ] Exact count on demand (button, cancellable, no 10 s limit)
- [ ] Bulk update options: upsert, `arrayFilters`, hint, collation
- [ ] Watch a collection live with change streams (replica sets and sharded clusters): inserts,
      updates and deletes stream into a live view; pause/resume; optional filter
- [ ] Query tabs: several queries on the same collection side by side as separate tabs, renamable,
      reopened from history

(Moved next to related work: find-query code export → M5, date timezone and other defaults →
M8 settings page, auto-update → M8 release workflow.)

## Ideas backlog (not scheduled)

Kept for later; move an item into a milestone when it is picked up.

Admin features Compass lacks:

- [ ] GridFS browser: list, upload, download files (bundle `mongofiles` like the other tools)
- [ ] Users and roles: create users, grant/revoke roles
- [ ] Replica set and sharding status: member health, replication lag, chunk distribution, balancer
- [ ] Compare two databases (e.g. staging vs. production): collections, counts, indexes,
      validation rules; diff of two documents
- [ ] Atlas Search and vector search indexes

Smaller items:

- [ ] SSH: jump hosts, SSH agent, reading `~/.ssh/config`
- [ ] Authentication: Kerberos (GSSAPI), browser sign-in flow for OIDC
- [ ] Job history kept across restarts
- [ ] Drag a file onto the window to start an import or restore
- [ ] Password-protected dump archives
- [ ] Test-data generator for developers
- [ ] Optional AI query assistant (natural language → filter) with the user's own API key

## ADR plan

| ADR       | Topic                                                                                  | Milestone | Status   |
| --------- | -------------------------------------------------------------------------------------- | --------- | -------- |
| 0001–0007 | Tauri, Rust owns DB, tauri-specta, frontend stack, organization, error model, keychain | M1        | Accepted |
| 0008      | Encrypted connection export                                                            | M2        | Accepted |
| 0009      | Bundled mongo-tools sidecars                                                           | M4        | Accepted |
| 0010      | Background job model                                                                   | M4        | Accepted |
| 0011      | Cursor streaming and pagination                                                        | M3        | Accepted |
| 0012      | Extended JSON as the editing format                                                    | M3        | Accepted |
| 0013      | SSH tunnels via russh, forcing `directConnection`                                      | M2        | Accepted |
| 0014      | No mongosh port in v1                                                                  | M8        | Planned  |
| 0015      | Testing strategy                                                                       | M8        | Planned  |
| 0016      | Pipeline code export in the frontend                                                   | M5        | Planned  |
| 0017      | Auto-update via the Tauri updater                                                      | M8        | Planned  |
| 0018      | Production and read-only connection modes                                              | M9        | Planned  |
| 0019      | Local write log and revert                                                             | M9        | Planned  |
| 0020      | Scheduled dumps                                                                        | M9        | Planned  |

## Working agreement

1. Vertical slices: backend → IPC → UI → tests → docs → changelog.
2. After each milestone: lint, type-check and tests pass; `CLAUDE.md`, `docs/` and
   `CHANGELOG.md` updated; this file's checkboxes updated; summary of done/next.
3. Small Conventional Commits.
4. Ambiguity → choose what a senior engineer would, record it in docs/ADR, continue. Stop to
   ask only for decisions that are expensive to reverse.
5. No faked features: stubs are labelled in the UI, docs and changelog.
