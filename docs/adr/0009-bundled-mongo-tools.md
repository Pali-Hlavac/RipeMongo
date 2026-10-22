# 0009. Bundle the MongoDB Database Tools as sidecars

- Status: Accepted
- Date: 2026-10-22

## Context

Dump, restore, import and export are core features, and users must not need a terminal or a
separate install. Re-implementing `mongodump`/`mongorestore` (BSON files, archives, oplog,
metadata, indexes) would take a long time and drift from the official format. The official
MongoDB Database Tools are Apache-2.0 licensed Go binaries published for every platform we
target.

## Decision

- Ship `mongodump`, `mongorestore`, `mongoexport` and `mongoimport` from the official
  **MongoDB Database Tools** as Tauri `externalBin` sidecars. Bundling is always on, even though
  the installer grows (user convenience first).
- **Pinned and verified:** `scripts/sidecars.lock.json` pins the version (100.19.1) and the
  SHA-256 of each platform archive. `pnpm sidecars` (`scripts/fetch-sidecars.mjs`) downloads
  only from `fastdl.mongodb.org`, refuses an archive whose checksum differs, and extracts the
  four binaries as `src-tauri/binaries/<tool>-<target-triple>[.exe]`. `--update-checksums`
  re-pins all targets and cross-checks MongoDB's published release feed. The archive readers
  are pure Node, so no system `tar`/`unzip` is involved.
- **Targets:** Windows x64, macOS x64, macOS arm64, Linux x64. Linux uses the `ubuntu2204`
  build (glibc 2.35, the same baseline as the Linux installers). It links
  `libgssapi_krb5.so.2`, so the `.deb` depends on `libgssapi-krb5-2` and the `.rpm` on
  `krb5-libs`.
- **Bundling config is separate:** `externalBin`, the license `resources` and the Linux
  package dependencies live in `src-tauri/tauri.sidecars.conf.json`, which only
  `pnpm app:build` merges (`tauri build --config …`). Tauri's build script fails when an
  `externalBin` file is missing, and keeping it out of `tauri.conf.json` lets `cargo build`,
  `cargo test`, clippy and `pnpm app:dev` work on a fresh clone without downloads.
- **Finding the binaries at runtime** (`src-tauri/src/tools/locate.rs`): next to the app
  executable (where Tauri installs sidecars, without the target suffix); in debug builds also
  `src-tauri/binaries/<tool>-<triple>`. The app starts them with `tokio::process` (not the shell
  plugin), so no shell permissions are exposed to the webview, the child is killed when the
  app drops it, and Windows does not open console windows (`CREATE_NO_WINDOW`).
- The tools' `LICENSE.md` and `THIRD-PARTY-NOTICES` are bundled as resources under
  `licenses/mongodb-database-tools/`.
- Binaries are git-ignored and never committed.

## Consequences

- The installer is larger. Measured on Windows (2026-10-22, tools 100.19.1, which add about
  57 MB uncompressed): NSIS installer 21.4 MiB, MSI 28.6 MiB.
- Updating the tools is a deliberate change: bump the version, re-pin, run the tool
  integration tests, add a changelog entry.
- Developers who want to run dump/restore locally run `pnpm sidecars` once. Without it the app
  still runs, and the About dialog and tool dialogs say the tools are missing.
- CI fetches the tools for its own platform so the tool integration tests run there.
- Authentication methods the tools do not support (for example OIDC environment providers)
  fail with the tools' own error; the app reports it rather than hiding it.
