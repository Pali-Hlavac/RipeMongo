# CLAUDE.md

## Project overview

RipeMongo is a cross-platform desktop MongoDB client: a full MongoDB Compass replacement that
also bundles the official database tools (`mongodump`, `mongorestore`, `mongoexport`,
`mongoimport`) so users never need a terminal. It is built with Tauri 2 (Rust backend) and
React + TypeScript (frontend). Plan and milestone status: [docs/roadmap.md](docs/roadmap.md); original
requirements: [docs/project-brief.md](docs/project-brief.md).

## Architecture

```
React feature component
  → feature api hook (TanStack Query)          src/features/<f>/api/*.ts
  → typed client: unwrap(commands.x())         src/shared/ipc/client.ts + generated bindings.ts
  ══ Tauri IPC (JSON, ACL-checked) ══
  → #[tauri::command] in <module>/commands.rs  thin: extract State, call service, map error
  → <module>/service.rs                        pure logic, testable without Tauri
  → mongodb driver / filesystem / keychain / sidecar process
  ← Result<T, DomainError> → From<DomainError> for AppError → { code, message, hint }
  ← client throws IpcError → ErrorState / toast
```

- **Only Rust talks to MongoDB.** The webview never opens sockets.
- **Types are generated**: Rust types deriving `specta::Type` and commands listed in
  `src-tauri/src/ipc.rs` are exported to `src/shared/ipc/bindings.ts` (`pnpm bindings`).
- **Errors**: each domain has a `thiserror` enum; it converts into the single serializable
  `AppError { code, message, hint }` (`src-tauri/src/error.rs`). Messages are for end users.
- **Background jobs** (milestone 4): cancellable tokio tasks in a job registry that report
  progress through Tauri events. See [docs/architecture/background-jobs.md](docs/architecture/background-jobs.md).
- **Sidecars**: mongo-tools binaries in `src-tauri/binaries/` (git-ignored), fetched by
  `pnpm sidecars` with a pinned version + SHA-256 checks, found and started by the `tools`
  module. See [docs/architecture/sidecars.md](docs/architecture/sidecars.md).

## Directory map

| Path                      | What lives there                                                                          |
| ------------------------- | ----------------------------------------------------------------------------------------- |
| `src/app/`                | App shell: providers, layout, query client, palette command wiring                        |
| `src/features/<feature>/` | One folder per feature: `components/ hooks/ api/ store/ lib/ types.ts`, public `index.ts` |
| `src/shared/ipc/`         | Generated `bindings.ts` + typed client (`unwrap`, `call`, `IpcError`)                     |
| `src/shared/ui/`          | shadcn/ui primitives (Radix based)                                                        |
| `src/shared/components/`  | App-wide components: `EmptyState`, `ErrorState`, `LoadingState`                           |
| `src/shared/{hooks,lib}/` | Generic hooks and pure helpers                                                            |
| `src-tauri/src/<module>/` | Rust domain module: `mod.rs commands.rs service.rs error.rs types.rs`                     |
| `src-tauri/src/ipc.rs`    | Command registry + bindings export                                                        |
| `src-tauri/capabilities/` | Tauri ACL: which commands the window may call                                             |
| `scripts/`                | Repo tooling (file-size check, sidecar fetcher)                                           |
| `docs/`                   | All documentation; start at `docs/README.md`                                              |
| `docs/user-guide/`        | End-user guide, one page per area; updated with every feature                             |

## Conventions

- **File size**: soft limit 200 lines, hard limit 300 (enforced by `pnpm lint`). Split early.
- **Naming**: React components `PascalCase.tsx`; hooks `useThing.ts`; other TS `camelCase.ts`
  or `kebab-case.ts` for UI primitives; Rust `snake_case`. Commands are verbs: `get_settings`.
- **TypeScript**: strict, no `any`, no `!` without a comment, `import type` for types.
- **Rust**: no `unwrap`/`expect` outside tests (clippy enforces); `///` docs on public items;
  top-of-file `//!` comment on every non-trivial file.
- **No magic numbers**: name constants (`SIDEBAR_SIZE`, `DEV_SERVER_PORT`, ...).
- **Feature boundaries**: import other features only through their `index.ts`.
- **State**: server/backend data → TanStack Query in `api/`; UI-only state → Zustand in
  `store/`; never copy query data into Zustand.
- **Styling**: Tailwind utilities + tokens from `src/app/styles.css`; use `cn()`; no inline
  colors. Every interactive element needs a visible focus state and an accessible name.
- **Dangerous actions** must use a confirm-by-typing dialog (added with the first such action).

### Adding a Tauri command end to end

1. Implement logic in `src-tauri/src/<module>/service.rs` with unit tests.
2. Add `#[tauri::command] #[specta::specta]` fn in `<module>/commands.rs` returning
   `CommandResult<T>`; add `impl From<ModuleError> for AppError` if new.
3. Register it in `collect_commands![]` in `src-tauri/src/ipc.rs`.
4. Add its name to `APP_COMMANDS` in `src-tauri/build.rs`.
5. Grant `allow-<kebab-name>` in `src-tauri/capabilities/default.json`.
6. `pnpm bindings` to regenerate `src/shared/ipc/bindings.ts`.
7. Call it from a feature `api/` hook via `unwrap(commands.x(...))`.
8. Document it in `docs/architecture/ipc.md` and the feature doc.

### Adding a feature folder

Create `src/features/<name>/` with only the subfolders you need, export the public surface
from `index.ts`, add `docs/features/<name>.md`, and register palette commands in
`src/app/commands/useAppCommands.ts`.

## Commands

| Task                       | Command                                                  |
| -------------------------- | -------------------------------------------------------- |
| Install                    | `pnpm install`                                           |
| Run the desktop app (dev)  | `pnpm app:dev`                                           |
| Build installers           | `pnpm app:build`                                         |
| Frontend tests             | `pnpm test` (watch: `pnpm test:watch`)                   |
| Rust tests                 | `pnpm test:rust`                                         |
| Lint (TS + file sizes)     | `pnpm lint`                                              |
| Lint Rust (clippy)         | `pnpm lint:rust`                                         |
| Type-check                 | `pnpm typecheck`                                         |
| Format / check formatting  | `pnpm format` / `pnpm format:check`                      |
| Regenerate IPC bindings    | `pnpm bindings`                                          |
| Everything CI runs         | `pnpm check`                                             |
| Fetch sidecars (tools)     | `pnpm sidecars` (once; needed to run dump/restore)       |
| Integration tests (Docker) | `pnpm test:rust` (start Docker first; skipped otherwise) |

## Gotchas

- **Windows tests**: `build.rs` embeds the Common-Controls manifest via linker args;
  otherwise `cargo test` exits with `STATUS_ENTRYPOINT_NOT_FOUND`.
- **New command returns "not allowed"**: you forgot step 4 or 5 above.
- **Bindings**: never edit `bindings.ts`; it is excluded from ESLint/Prettier on purpose.
  Debug app runs also regenerate it.
- **Big integers**: specta refuses `i64/u64` in exported types (JS numbers lose precision).
  Use `f64` for sizes/counts or strings for exact values.
- **specta versions are pinned** (`=2.0.0-rc.26`, `specta-typescript =0.0.13`); upgrade them together.
- **jsdom is pinned to 27.x** because jsdom 30 needs Node ≥ 22.22.
- **Secrets never go to the webview**: send `SecretUpdates`, read `StoredSecrets` booleans.
  Never add a command that returns a stored secret.
- **russh uses the `ring` backend** (`default-features = false`); its default `aws-lc-rs`
  needs CMake/NASM on Windows. `mongodb`'s `aws-auth` still pulls `aws-lc-sys`, which builds
  without extra tools today.
- **Keychain on Linux** needs a Secret Service provider (GNOME Keyring/KWallet); CI unit tests
  use `MemorySecretStore`, never the real keychain.
- **Tauri sync commands run on the main thread**: make any command doing I/O `async`.
- **`disable_serde_phases()`** in `ipc.rs`: one TS type per Rust type; send full objects.
- **TypeScript is pinned to 6.0** until `typescript-eslint` supports TS 7.
- **CSP** is strict (`tauri.conf.json`); Monaco workers use `worker-src blob:` (allowed).
- **Monaco + `freezePrototype`**: Monaco is patched (`patches/`, pnpm `patchedDependencies`)
  so it loads with a frozen `Object.prototype`. Upgrading Monaco means re-creating the patch
  (`pnpm patch monaco-editor@<v>`); `pnpm lint` flags new offending assignments.
- **Sidecars and `externalBin`**: `externalBin` is only in `src-tauri/tauri.sidecars.conf.json`
  (merged by `pnpm app:build`); putting it in `tauri.conf.json` breaks every cargo build that
  has not run `pnpm sidecars`. Start tools with `tools::tool_command` (no console window,
  killed on drop), never the shell plugin.
- **Linux** dev needs `libwebkit2gtk-4.1-dev` and friends (see docs/getting-started.md).

## Where to find more

- [docs/README.md](docs/README.md): index of all docs
- [docs/roadmap.md](docs/roadmap.md): milestones, scope checklists, agreed decisions
- [docs/architecture/](docs/architecture/): overview, IPC, modules, security
- [docs/features/](docs/features/): one file per user-facing feature
- [docs/adr/](docs/adr/): architecture decisions
- [docs/development/](docs/development/): testing, standards, release, troubleshooting

## Rules for AI agents

1. Read this file and the relevant `docs/features/*.md` before changing code.
2. Follow the vertical slice order: backend → IPC → UI → tests → docs → changelog.
3. Update the docs, the end-user guide (`docs/user-guide/`, plain language, no internals) and
   `CHANGELOG.md` (`[Unreleased]`) with every change, and tick the
   checklist in `docs/roadmap.md` when a scope item is done.
4. Never commit secrets, connection strings with passwords or sidecar binaries.
5. Run `pnpm check` (lint, types, tests, clippy) before declaring work done.
6. Don't fake features: stubs must be labelled in the UI, the docs and the changelog.
7. Use Conventional Commits (`feat:`, `fix:`, `docs:`, `chore:`, ...).
