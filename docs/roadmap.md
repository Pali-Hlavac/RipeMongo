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

### M2 — Connections 🚧 (in progress)

Legend for this milestone: **BE** = backend + IPC done and tested, **UI** = frontend done.

- [~] Saved connections: create, edit, duplicate, delete — BE ✅, UI ⏳
- [~] Folders/groups, favorites, color labels — BE ✅, UI ⏳ (tree grouping helper done)
- [~] Connection string ⇄ structured form, two-way sync — BE ✅ (Rust parser/builder, 24 tests), UI ⏳
- [~] Auth: SCRAM-SHA-1/256, X.509, LDAP (PLAIN), AWS IAM, OIDC (environment providers) — BE ✅, UI ⏳
- [~] TLS: CA file, client certificate/key (+ key password), allow invalid certs/hostnames — BE ✅, UI ⏳
- [~] SSH tunnel: password and private key with passphrase, host-key verification — BE ✅ (not yet tested against a real sshd), UI ⏳
- [x] Secrets in the OS keychain only; redaction of connection strings in logs/errors
- [~] Test connection; connect / disconnect; multiple simultaneous connections — BE ✅, UI ⏳
- [ ] Connection overview tab (server version, topology, hosts)
- [~] Import/export connections: without secrets, or encrypted with a password — BE ✅, UI ⏳
- [x] Integration tests with testcontainers (MongoDB 8 with SCRAM auth)
- [ ] ADRs 0008 (encrypted export), 0013 (SSH tunnels); docs/features/connections.md; CHANGELOG entries

#### Where we left off (2026-10-22)

Backend is complete and committed (`src-tauri/src/connections/`, `ssh/`, `secrets/`,
`storage/`). Frontend work had started in `src/features/connections/`:

- Done: `types.ts`, `api/` (keys, profiles, session, transfer hooks), `lib/` (defaults,
  colors, secrets, tree + tests); shared form primitives (`shared/ui/input.tsx`,
  `form-field.tsx`, `tabs.tsx`, `shared/components/ConfirmDialog.tsx`); workspace tabs are a
  union (`welcome` | `connection`) rendered via `src/app/layout/renderTab.tsx`; mutations can
  set `meta: { silent: true }` to skip the global error toast.
- Next, in order:
  1. `store/` for dialog state (editor open/create/edit, delete target, import/export mode).
  2. Editor dialog: URI field with debounced parse/build sync (keep `ssh` from the form when a
     URI is parsed), tabs General / Authentication / TLS / SSH / Advanced, `SecretField`
     (shows "saved in keychain", Keep/Set/Clear), `FilePathField` (dialog plugin `open`),
     Test button with inline result.
  3. Sidebar (`ConnectionSidebar`) replacing `src/app/layout/Sidebar.tsx`: favorites, folders,
     ungrouped, status dot, per-item actions menu (connect/disconnect, edit, duplicate,
     favorite, delete), empty state with "New connection".
  4. Connection overview tab (server info, disconnect) and the `connection` case in
     `renderTab.tsx` (currently returns `null`; nothing opens connection tabs yet).
  5. Import/Export dialogs; palette commands (new, import, export, connect to …);
     Welcome view "New connection" action.
  6. Component tests; ADRs 0008 + 0013; `docs/features/connections.md`; update
     `docs/architecture/{ipc,backend-modules,security}.md`, `CLAUDE.md`, `CHANGELOG.md`.
  7. Run the app against a Docker MongoDB and verify end to end, then tick this list.

### M3 — Browsing, documents, query bar

- [ ] Sidebar tree: databases, collections, views with counts and sizes
- [ ] Create/drop databases, collections, views, capped and time-series collections; rename collections
- [ ] Confirm-by-typing dialog for destructive actions
- [ ] Documents: list (JSON tree), JSON and virtualized table views
- [ ] Query bar: filter, project, sort, collation, skip, limit, maxTimeMS; field/operator autocomplete
- [ ] Query history and favorite queries per collection
- [ ] Insert, edit (inline + Monaco JSON editor), clone, delete; bulk update/delete with preview + confirmation
- [ ] Full BSON/Extended JSON support (ObjectId, Date, Decimal128, Long, Binary, UUID, Regex, …)
- [ ] Cursor streaming/pagination; never load a whole collection
- [ ] Replica-set integration tests; ADRs 0011 (cursor streaming), 0012 (Extended JSON)

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
| 0011      | Cursor streaming and pagination                                                        | M3        | Planned  |
| 0012      | Extended JSON as the editing format                                                    | M3        | Planned  |
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
