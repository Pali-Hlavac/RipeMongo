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
- [~] SSH tunnel: password and private key with passphrase, host-key verification — implemented and unit tested; not yet verified against a real SSH server (add an sshd container test in M3)
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

### M3 — Browsing, documents, query bar 🚧 (in progress)

- [x] Sidebar tree: databases, collections, views with counts and sizes
- [x] Create/drop databases, collections, views, capped and time-series collections; rename collections
- [x] Confirm-by-typing dialog for destructive actions
- [x] Documents: list (JSON tree), JSON and virtualized table views
- [x] Query bar: filter, project, sort, collation, skip, limit, maxTimeMS; field/operator autocomplete
- [x] Shell-style query syntax (`{_id: ObjectId("…")}`, `ISODate(…)`, unquoted keys, `/regex/`)
- [x] Query history and favorite queries per collection
- [ ] Insert, edit (inline + Monaco JSON editor), clone, delete; bulk update/delete with preview + confirmation
- [x] Full BSON/Extended JSON support (ObjectId, Date, Decimal128, Long, Binary, UUID, Regex, …)
- [x] Paged loading; never load a whole collection
- [ ] Replica-set integration tests; SSH tunnel test against a real sshd (carried over from M2)
- [ ] ADRs 0011 (paging), 0012 (Extended JSON); feature docs; user guide pages

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

**Next: slice 5 (CRUD + Monaco)**

1. Backend `documents` writes: `insert_documents` (one or many, parsed by `ejson`),
   `replace_document` (by `_id`, the edited text), `update_document` for inline field edits
   (`$set`/`$unset` by `_id`), `delete_document`; clone = insert without `_id`. Integration
   tests incl. validation errors (121) and duplicate keys (11000).
2. Monaco editor (local `monaco-editor` with a worker; CSP already allows `worker-src blob:`)
   in "Edit document" / "Insert documents" dialogs, prefilled with `toShell`, errors shown
   with line/column markers.
3. Document card actions: Edit, Clone, Delete (confirm), plus inline edit of a scalar field in
   the list view; no write actions on views.
4. Then slices 6 (bulk update/delete with preview + confirm-by-typing) and 7 (replica-set and
   sshd integration tests, docs, user guide, verification).

Verified in the real app (2026-10-22, MongoDB 8 in Docker, 120 nested sample documents): list,
JSON and table views, paging, filter with field suggestions, sort, inline query errors, history
and favorites. Fixed afterwards: colon spacing, dimmer placeholders, no pager range on errors,
favorite summary wrapping, and history removal when a connection is deleted.

### M4 — Tools: dump, restore, import, export, copy

- [ ] Sidecar fetch script (pinned version, SHA-256 verification), bundling for all 4 targets
- [ ] Background job registry: progress events, cancel, logs — ADR 0010
- [ ] Dump UI: server / databases / collections, query filter, gzip, archive, oplog, include/exclude, parallelism
- [ ] Restore UI: drop before restore, `nsFrom`/`nsTo`, dry run
- [ ] Live progress, cancel, readable errors, copyable log, equivalent CLI command
- [ ] Saved dump profiles (one-click re-run)
- [ ] JSON/CSV import and export per collection with field selection and type mapping
- [ ] Copy collection/database between connections
- [ ] Measure installer size — ADR 0009

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
| 0008      | Encrypted connection export                                                            | M2        | Planned  |
| 0009      | Bundled mongo-tools sidecars                                                           | M4        | Planned  |
| 0010      | Background job model                                                                   | M4        | Planned  |
| 0011      | Cursor streaming and pagination                                                        | M3        | Accepted |
| 0012      | Extended JSON as the editing format                                                    | M3        | Accepted |
| 0013      | SSH tunnels via russh, forcing `directConnection`                                      | M2        | Planned  |
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
