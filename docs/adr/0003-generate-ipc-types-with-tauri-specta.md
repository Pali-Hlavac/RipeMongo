# 0003. Generate IPC types with tauri-specta

- Status: Accepted
- Date: 2026-10-22

## Context

Hand-duplicating Rust types in TypeScript drifts. Options: `ts-rs` (types only) or
`tauri-specta` (types plus typed command wrappers plus typed events).

## Decision

Use `tauri-specta` `=2.0.0-rc.26` with `specta =2.0.0-rc.26` and `specta-typescript =0.0.13`
(pinned exactly, because these crates are pre-1.0 and must match). Bindings are generated into
`src/shared/ipc/bindings.ts` by a unit test (`pnpm bindings`) and on debug runs. The default
`Result` error-handling mode returns `{status, data|error}`; `shared/ipc/client.ts` unwraps it
into `IpcError`.

## Consequences

- No raw `invoke("...")` strings; renaming a command breaks the TS build, not production.
- Exported types cannot use `i64`/`u64` (JS precision); use `f64` or strings.
- If tauri-specta stalls, the fallback is `ts-rs` plus a hand-written command map, recorded
  in a superseding ADR.
