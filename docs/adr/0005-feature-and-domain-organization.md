# 0005. Organize by feature (frontend) and domain module (backend)

- Status: Accepted
- Date: 2026-10-22

## Context

Layer-based folders (`components/`, `hooks/`) scatter one feature across the tree and grow
without bound. Both humans and AI agents work faster when a feature is self-contained.

## Decision

- Frontend: `src/features/<feature>/{components,hooks,api,store,lib}` plus `types.ts` and a
  public `index.ts`. Cross-feature imports go through `index.ts` only. Generic code lives in
  `src/shared/`, app wiring in `src/app/`.
- Backend: one module per domain with `commands.rs` (Tauri boundary), `service.rs` (logic),
  `error.rs`, `types.rs`.
- Files stay under 300 lines (enforced).

## Consequences

- Deleting or moving a feature is a folder operation.
- Some duplication pressure across features; anything reused twice moves to `shared/`.
