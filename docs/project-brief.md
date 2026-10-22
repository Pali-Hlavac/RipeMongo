# Project brief: a cross-platform MongoDB GUI (Compass replacement + built-in tools)

> **Original project brief, kept for reference.** The app was renamed to **RipeMongo**, and the
> approved plan, milestones and agreed deviations are in [roadmap.md](roadmap.md).

You are a senior software engineer starting a brand-new project from an empty repository. Build a **desktop MongoDB client** that fully replaces MongoDB Compass. It should be pleasant, fast and small, and it should ship the MongoDB database tools (dump, restore, import, export) **inside the app**, so users never need the command line.

Working name: **Mongo Studio** (keep it in one constant/config so it can be renamed easily).

Read this whole brief before writing code. Start by proposing a plan (see "How to work" at the end).

---

## 1. Tech stack (fixed decisions)

- **Shell:** Tauri 2 (Rust). The app must stay small: aim for an installer under ~40 MB including the bundled tools.
- **Backend (Rust):** official `mongodb` driver + `bson`, `tokio`, `serde`, `thiserror` for errors, `tracing` for logging, `keyring` for secrets, `russh` (or equivalent) for SSH tunnels.
- **Frontend:** React + TypeScript (strict mode) + Vite.
  - Tailwind CSS + shadcn/ui (Radix) for components
  - TanStack Query for backend calls/caching, TanStack Table + virtualization for grids
  - Zustand for UI state
  - Monaco editor for queries, aggregation stages, JSON documents and validation rules
- **Package manager:** pnpm.
- **Bundled tools:** the official `mongo-tools` binaries (`mongodump`, `mongorestore`, `mongoexport`, `mongoimport`) shipped as **Tauri sidecars**, one build per platform (Windows x64, macOS x64 + arm64, Linux x64). Write a script that downloads a **pinned version** and **verifies checksums**. Never commit the binaries to git.
- **Targets:** Windows, macOS and Linux, all treated as first-class.

If you think any of these choices is clearly wrong, raise it with a short reason **before** you deviate. Record each major decision as an ADR (see section 5).

---

## 2. Feature scope: full Compass parity, plus extras

### 2.1 Connections

- Connection manager: create, edit, duplicate, delete, group/folder, favorite and color-label connections
- Connection string input **and** a structured form (host, port, auth, TLS, replica set, read preference, `mongodb+srv`), kept in two-way sync
- Auth: SCRAM, X.509, LDAP/PLAIN, AWS, OIDC where the driver supports it
- TLS/SSL with CA, client certificates and keys
- SSH tunnel (password and private key, with passphrase)
- Credentials stored in the OS keychain, **never** in plain-text config files
- Import/export saved connections (without secrets, or encrypted with a password)
- Multiple simultaneous connections in tabs/windows

### 2.2 Navigation and administration

- Sidebar tree: databases, collections and views, with document counts and sizes
- Create/drop databases, collections, views, capped and time-series collections
- Rename collections

### 2.3 Documents

- Views: **list** (expandable JSON tree), **JSON** (raw) and **table** (virtualized grid)
- Query bar: filter, project, sort, collation, skip, limit, maxTimeMS, with autocomplete for field names and operators
- Query history and saved/favorite queries per collection
- Insert, edit (inline and in a JSON editor), clone and delete documents; bulk update and bulk delete with a preview and a confirmation step
- Correct display and editing of all BSON types (ObjectId, Date, Decimal128, Long, Binary, UUID, Regex, etc.) using Extended JSON
- Smooth pagination and streaming for very large collections; never load a whole collection into memory

### 2.4 Aggregation

- Visual pipeline builder: add, reorder (drag and drop), enable/disable and delete stages, with a **preview of sample output after each stage**
- Text mode for the whole pipeline, kept in sync with the builder
- Stage templates and operator autocomplete
- Save pipelines, create a view from a pipeline, export a pipeline to code (JS, Python, Java, C#, Go, Rust)

### 2.5 Schema, indexes, performance

- Schema analysis on a sample: field types, frequencies and value distributions, with charts
- Explain plan: visual tree + raw output, highlighting COLLSCAN and index usage
- Indexes: list with size and usage stats; create (single, compound, text, geo, TTL, partial, unique, hidden, wildcard); drop; hide/unhide
- Validation rules: JSON Schema editor, validation level/action, test against sample documents
- Server performance dashboard: ops/sec, connections, network, memory, slow operations; kill operations

### 2.6 Import / export / tools (the extra value over Compass)

- Import/export JSON and CSV per collection, with field selection, type mapping and a progress bar
- **Dump / restore UI** wrapping the bundled `mongodump` / `mongorestore`:
  - choose a connection, then whole server / databases / collections, plus an optional query filter
  - options: gzip, archive file, oplog, include/exclude collections, parallelism
  - restore options: drop before restore, namespace remapping (`nsFrom`/`nsTo`), dry run
  - live progress, cancel, readable error messages, and a log you can view and copy
  - saved "dump profiles" so a dump can be re-run with one click
- Copy a collection or database between two connections
- Show the equivalent CLI command for every tool run, for power users

### 2.7 Built-in shell

- A lightweight command console for running ad-hoc commands (`runCommand`, admin commands) with results in the same viewers.
- A full `mongosh` port is **out of scope for v1**; document this decision in an ADR.

### 2.8 UX quality bar

- Feels like a polished native app: fast startup, keyboard shortcuts everywhere, a command palette (Ctrl/Cmd+K), tabs, resizable panels
- Light/dark/system theme
- Clear empty, loading and error states. Errors explain what happened and what to do next
- Dangerous actions (drop, bulk delete, restore with drop) require explicit confirmation, e.g. typing the name
- Accessible: focus states, ARIA labels, contrast
- Remember window size, open tabs and last connection

---

## 3. Architecture requirements

- **Clear layers.** Frontend never talks to MongoDB directly. All database access goes through Tauri commands in Rust.
- **Rust backend** organized by domain modules, for example:
  `connections/`, `ssh/`, `databases/`, `collections/`, `documents/`, `aggregation/`, `schema/`, `indexes/`, `validation/`, `server_stats/`, `tools/` (sidecar runner), `import_export/`, `settings/`, `secrets/`, `error.rs`
  - Each module has a thin `commands.rs` (the Tauri boundary) and a separate service/logic layer that can be tested without Tauri
  - One typed error enum per domain via `thiserror`, mapped to a serializable error type for the frontend
  - Long-running jobs (dumps, imports, schema sampling) run as cancellable background tasks that report progress through Tauri events
- **Frontend** organized by feature, not by file type:
  `src/features/<feature>/{components,hooks,api,store,types}`, plus `src/shared/` for UI primitives, utilities and the typed IPC client
  - One typed wrapper around `invoke` and events. No raw `invoke("...")` strings scattered through components
  - Generate the shared types between Rust and TS (e.g. `specta` / `tauri-specta` or `ts-rs`) instead of duplicating them by hand
- **Security:** secrets only in the keychain; never log connection strings with passwords (redact them); a strict Tauri capabilities/permissions config with the minimum needed
- **Performance:** stream cursors in batches; virtualized lists; keep heavy work off the UI thread

---

## 4. Code quality: write like a senior engineer

- **Small files, single responsibility.** Soft limit ~200 lines per file, hard limit ~300. Split before you get there. Keep functions short and well named.
- Clean code: descriptive names, no dead code, no commented-out code, no magic numbers (use named constants), no copy-paste. Extract shared logic.
- TypeScript: `strict`, no `any` (use `unknown` + narrowing), no non-null assertions without a comment explaining why.
- Rust: `cargo clippy -- -D warnings` clean, `rustfmt`, no `unwrap()`/`expect()` in non-test code except for documented invariants.
- Linting/formatting: ESLint + Prettier on the frontend, rustfmt + clippy on the backend, enforced in CI and in a pre-commit hook.
- **Tests:**
  - Rust unit tests for service logic
  - Integration tests against a real MongoDB in Docker (testcontainers), including a replica set for features that need one
  - Frontend component/hook tests with Vitest + Testing Library
  - A few Playwright (or WebdriverIO + tauri-driver) end-to-end smoke tests for critical flows: connect, query, edit document, dump/restore
- **CI:** GitHub Actions with lint + test on every PR, plus a release workflow that builds, signs and notarizes installers for all platforms, sidecars included. Leave clear TODOs and docs for the signing secrets.
- Conventional Commits for commit messages.

---

## 5. Documentation: make onboarding fast for humans and AI agents

A new developer or AI agent should be productive within minutes. Documentation is part of "done" for every feature.

### 5.1 `CLAUDE.md` (repo root)

Create it at the start and keep it up to date. Keep it concise and skimmable. It must contain:

- **Project overview:** what the app is, in 3–5 lines
- **Architecture:** layers, the IPC boundary, how a request flows UI → typed client → Tauri command → service → driver → back, how background jobs and progress events work, how sidecars are located and run. Include a short ASCII or Mermaid diagram
- **Directory map:** what lives where, one line per important folder
- **Conventions:** file size limits, naming, error handling, how to add a new Tauri command end to end, how to add a new feature folder, state management rules, styling rules, testing rules
- **Commands:** install, dev, build, test, lint, format, fetch sidecars, run integration tests
- **Gotchas:** platform quirks, webview differences, signing, anything non-obvious
- **Where to find more:** links into `docs/`
- **Rules for AI agents:** read `CLAUDE.md` and the relevant `docs/features/*` before changing code; update docs and `CHANGELOG.md` with every change; never commit secrets or sidecar binaries; run lint and tests before finishing

### 5.2 `docs/` folder

Document **every feature and every important file/module**:

```
docs/
  README.md                 # index of all docs, start here
  getting-started.md        # setup from zero, prerequisites per OS
  architecture/
    overview.md
    ipc.md                  # command list, events, error model, type generation
    backend-modules.md      # one section per Rust module: purpose, public API, key files
    frontend-structure.md   # features, shared, state, routing
    background-jobs.md
    sidecars.md             # bundling, versions, checksums, update procedure
    security.md
  features/                 # one file per user-facing feature
    connections.md
    documents.md
    query-bar.md
    aggregation.md
    schema.md
    indexes.md
    validation.md
    performance.md
    import-export.md
    dump-restore.md
    console.md
    ...
  development/
    testing.md
    coding-standards.md
    release.md              # versioning, signing, notarization, publishing
    troubleshooting.md
  adr/                      # Architecture Decision Records, numbered: 0001-use-tauri.md, ...
```

Each feature doc covers: what it does for the user, how it works internally (data flow), the key files involved (with paths), edge cases and limitations, and how to test it.

Also add a short top-of-file comment in each non-trivial source file saying what it is responsible for. Add doc comments (`///` in Rust, TSDoc in TS) on public functions and types.

### 5.3 `CHANGELOG.md`

- Follow the [Keep a Changelog](https://keepachangelog.com) format with Semantic Versioning
- Keep an `## [Unreleased]` section and add an entry for every meaningful change (Added / Changed / Fixed / Removed / Security)
- Start at `0.1.0`

### 5.4 `README.md`

User-facing: what the app is, screenshots placeholder, download/install, build from source, link to `docs/`.

---

## 6. How to work

1. **Plan first.** Before writing code, give me:
   - the proposed repo structure
   - the list of ADRs you will write
   - a phased roadmap with milestones, each ending in a runnable, tested app

   Suggested phases:
   1. scaffold + tooling + CI + `CLAUDE.md` + docs skeleton
   2. connections (incl. keychain, TLS, SSH)
   3. browsing + documents CRUD + query bar
   4. dump/restore/import/export with sidecars
   5. aggregation builder
   6. indexes + explain + validation
   7. schema analysis + performance dashboard
   8. console, polish, accessibility, packaging/signing

   Wait for my OK on the plan.
2. **Work in vertical slices.** Each slice goes backend → IPC → UI → tests → docs → changelog.
3. After each phase, make sure lint, type-check and tests pass. Update `CLAUDE.md`, the relevant `docs/` files and `CHANGELOG.md`, then summarize what was done and what's next.
4. Commit in small, logical commits using Conventional Commits.
5. When something is ambiguous, pick the option a senior engineer would choose, note the assumption in the docs/ADR, and continue. Only stop to ask when a decision is expensive to reverse.
6. Don't fake features. If something is stubbed, mark it clearly in the UI, the docs and the changelog.
