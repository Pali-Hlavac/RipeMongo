# Testing

| Layer                   | Tooling                                     | Location                        | Command          |
| ----------------------- | ------------------------------------------- | ------------------------------- | ---------------- |
| Rust unit               | `cargo test`                                | `#[cfg(test)]` next to the code | `pnpm test:rust` |
| Rust integration        | testcontainers (MongoDB in Docker)          | `src-tauri/tests/` (M2+)        | `pnpm test:rust` |
| Frontend unit/component | Vitest + Testing Library + jsdom            | `src/**/*.test.ts(x)`           | `pnpm test`      |
| End-to-end smoke        | WebdriverIO + tauri-driver (Linux, Windows) | `e2e/` (M8)                     | planned          |

## Rules

- Service logic gets unit tests; command fns stay thin enough not to need them.
- Test behaviour through public APIs (store actions, rendered roles/labels), not internals.
- Query by accessible role and name in component tests. That also checks accessibility.
- Mock IPC at the `@/shared/ipc/bindings` module boundary (`vi.mock`), never `invoke`.
- New bugs get a regression test.
- Integration tests that need Docker are skipped with a clear message when Docker is
  unavailable. Replica-set features use a single-node replica set container.

## Notes

- `src/test/setup.ts` stubs `matchMedia`, `ResizeObserver` and `scrollIntoView` for jsdom.
- On Windows, Rust test binaries need the Common-Controls manifest; `build.rs` handles it.
- E2E tests cannot run on macOS (no WKWebView WebDriver); see ADR 0015 when written.
