# Sidecars (bundled MongoDB Database Tools)

> **Status: design only. Implementation is planned for milestone 4.**

RipeMongo ships `mongodump`, `mongorestore`, `mongoexport` and `mongoimport` from the
official [MongoDB Database Tools](https://www.mongodb.com/docs/database-tools/) as Tauri
sidecars, so users never install anything. Bundling is **always on**, even though it makes
the installer larger (user convenience comes first; see ADR 0009 when written).

## Plan

- `scripts/sidecars.lock.json` pins the tools version and the SHA-256 of each platform
  archive (Windows x64, macOS x64, macOS arm64, Linux x64).
- `pnpm sidecars` (`scripts/fetch-sidecars.mjs`) downloads the archive for the current or
  requested target triple, verifies the checksum, extracts the four binaries and renames them
  to `src-tauri/binaries/<tool>-<target-triple>[.exe]` as Tauri expects.
- `tauri.conf.json` `bundle.externalBin` lists the four tools; the release workflow fetches
  sidecars for each matrix target before `tauri build`.
- Binaries are git-ignored and never committed.
- At runtime the `tools` module resolves sidecars through the Tauri shell plugin, builds
  arguments from typed options, redacts credentials from the displayed CLI command, and
  streams stdout/stderr into job logs.

## Updating the tools version

1. Change the version in `sidecars.lock.json`.
2. Run `pnpm sidecars --update-checksums` and review the diff.
3. Run the dump/restore integration tests.
4. Add a `Changed` entry to `CHANGELOG.md`.
