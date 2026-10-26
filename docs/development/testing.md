# Testing

| Layer                   | Tooling                                     | Location                        | Command          |
| ----------------------- | ------------------------------------------- | ------------------------------- | ---------------- |
| Rust unit               | `cargo test`                                | `#[cfg(test)]` next to the code | `pnpm test:rust` |
| Rust integration        | testcontainers (MongoDB in Docker)          | `src-tauri/tests/`              | `pnpm test:rust` |
| Frontend unit/component | Vitest + Testing Library + jsdom            | `src/**/*.test.ts(x)`           | `pnpm test`      |
| End-to-end smoke        | WebdriverIO + tauri-driver (Linux, Windows) | `e2e/` (M8)                     | planned          |

## Rules

- Service logic gets unit tests; command fns stay thin enough not to need them.
- Test behaviour through public APIs (store actions, rendered roles/labels), not internals.
- Query by accessible role and name in component tests. That also checks accessibility.
- Mock IPC at the `@/shared/ipc/bindings` module boundary (`vi.mock`), never `invoke`; render
  with `renderWithProviders` and return results with `ok(data)` (`src/test/render.tsx`).
- Integration tests share helpers in `src-tauri/tests/common/` (container start-up, a
  `ConnectionManager` with an in-memory secret store). Without Docker they print `SKIPPED` and
  pass, so start Docker before relying on them.
- New bugs get a regression test.
- Integration tests that need Docker are skipped with a clear message when Docker is
  unavailable. Replica-set features use a single-node replica set container
  (`common::start_replica_set`, initiated through the driver). SSH tests run OpenSSH
  (`panubo/sshd`, pinned) with a generated key, next to a MongoDB on a private Docker network.
- Tests that run the bundled MongoDB tools (`tests/tools.rs`, later dump/restore) skip with a
  message until `pnpm sidecars` has fetched them; CI fetches them first.
- `scripts/**/*.test.mjs` (for example the sidecar archive readers) run with `pnpm test`.

## Large-file import

`src-tauri/tests/import_large.rs` is an opt-in load test, marked `#[ignore]` so neither
`pnpm test:rust` nor CI runs it. It generates a JSON lines file and a CSV file with the same
documents (an order of about 330 bytes with a decimal total, a date and a note) in a temporary
folder that is deleted afterwards, then imports each into a fresh MongoDB container with one
and with several insert workers, and cancels a CSV import at 30 % of the file. It checks that
every document arrived, that progress never goes back nor stands still for 5 seconds, that
RipeMongo grows by less than 256 MiB and mongoimport stays under 1 GiB whatever the size, and
that cancelling ends the job within 10 seconds with no mongoimport left running.

```sh
cd src-tauri
RIPEMONGO_LARGE_IMPORT_GB=3 cargo test --test import_large -- --ignored --nocapture
```

`RIPEMONGO_LARGE_IMPORT_GB` sets the JSON file size (default 2), `RIPEMONGO_LARGE_IMPORT_WORKERS`
the parallel run (default 8). It needs Docker, `pnpm sidecars` and free disk space for both
files plus the imported data. A debug build is enough: mongoimport sets the pace.

Results on 2026-10-26: 9,636,191 documents, 3,072 MiB as JSON and 2,493 MiB as CSV;
Windows 11, Intel Core i9-14900HX, 32 GB RAM, SSD, MongoDB 8.0 in Docker Desktop (32 CPUs,
16 GB), mongo-tools 100.19.1.

| File | Insert workers | Time  | Throughput | Documents/s | Longest progress pause | RipeMongo growth | mongoimport peak |
| ---- | -------------- | ----- | ---------- | ----------- | ---------------------- | ---------------- | ---------------- |
| JSON | 1              | 203 s | 15 MiB/s   | 47,376      | 3.0 s                  | 0 MiB            | 38 MiB           |
| JSON | 8              | 94 s  | 33 MiB/s   | 102,681     | 3.0 s                  | 0 MiB            | 55 MiB           |
| CSV  | 1              | 170 s | 15 MiB/s   | 56,705      | 3.2 s                  | 0 MiB            | 35 MiB           |
| CSV  | 8              | 90 s  | 28 MiB/s   | 107,352     | 3.1 s                  | 0 MiB            | 52 MiB           |

Eight workers import about twice as fast as one. Memory does not depend on the file size (a
0.2 GB run showed the same figures). The cancelled import stopped 0.3 s after the request.
Progress moves every 3 seconds, the interval at which mongoimport reports.

## Notes

- `src/test/setup.ts` stubs `matchMedia`, `ResizeObserver` and `scrollIntoView` for jsdom.
- On Windows, Rust test binaries need the Common-Controls manifest; `build.rs` handles it.
- E2E tests cannot run on macOS (no WKWebView WebDriver); see ADR 0015 when written.
