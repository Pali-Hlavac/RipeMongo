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
- [ ] JSON/CSV import and export per collection with field selection and type mapping
- [ ] Copy collection/database between connections
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
- Slice 5 next: JSON/CSV export and import per collection with field selection and type
  mapping.

### M5 — Aggregation

- [ ] Visual stage builder: add, drag-and-drop reorder, enable/disable, delete
- [ ] Per-stage sample output preview
- [ ] Text mode synced with the builder; stage templates; operator autocomplete
- [ ] Save pipelines; create view from pipeline
- [ ] Export to JS, Python, Java, C#, Go, Rust — ADR 0016

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
- [ ] E2E smoke tests: connect, query, edit document, dump/restore — ADR 0015
- [ ] Release workflow: build, sign, notarize installers for all platforms with sidecars
- [ ] `docs/development/release.md` finalized

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

## Working agreement

1. Vertical slices: backend → IPC → UI → tests → docs → changelog.
2. After each milestone: lint, type-check and tests pass; `CLAUDE.md`, `docs/` and
   `CHANGELOG.md` updated; this file's checkboxes updated; summary of done/next.
3. Small Conventional Commits.
4. Ambiguity → choose what a senior engineer would, record it in docs/ADR, continue. Stop to
   ask only for decisions that are expensive to reverse.
5. No faked features: stubs are labelled in the UI, docs and changelog.
