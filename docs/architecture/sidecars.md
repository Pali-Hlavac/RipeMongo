# Sidecars (bundled MongoDB Database Tools)

RipeMongo ships `mongodump`, `mongorestore`, `mongoexport` and `mongoimport` from the
official [MongoDB Database Tools](https://www.mongodb.com/docs/database-tools/) as Tauri
sidecars, so users never install anything. Bundling is **always on**, even though it makes
the installer larger (user convenience comes first). Decision record:
[ADR 0009](../adr/0009-bundled-mongo-tools.md).

## Pieces

| Piece                                | Role                                                                                |
| ------------------------------------ | ----------------------------------------------------------------------------------- |
| `scripts/sidecars.lock.json`         | Pinned tools version, archive URL and SHA-256 per target triple                     |
| `scripts/fetch-sidecars.mjs`         | `pnpm sidecars`: download, verify, extract to `src-tauri/binaries/`                 |
| `scripts/lib/archive.mjs`            | Pure-Node zip and tar.gz readers (tested in `archive.test.mjs`)                     |
| `src-tauri/binaries/` (git-ignored)  | `<tool>-<target-triple>[.exe]`, the tools' licenses, a `.<triple>.stamp` per target |
| `src-tauri/tauri.sidecars.conf.json` | `externalBin`, license resources, Linux package dependencies                        |
| `src-tauri/src/tools/`               | Finds the binaries, starts them, reports versions (`get_tools_info`)                |

## Fetching

```sh
pnpm sidecars                        # tools for this computer (skips if already up to date)
pnpm sidecars --target all           # every target, e.g. before cross-packaging
pnpm sidecars --target aarch64-apple-darwin
pnpm sidecars --force                # download again
```

The script refuses an archive whose SHA-256 differs from the lock file. A stamp file records
which version and archive produced the binaries, so repeated runs are instant.

| Target triple              | MongoDB build       |
| -------------------------- | ------------------- |
| `x86_64-pc-windows-msvc`   | `windows-x86_64`    |
| `x86_64-apple-darwin`      | `macos-x86_64`      |
| `aarch64-apple-darwin`     | `macos-arm64`       |
| `x86_64-unknown-linux-gnu` | `ubuntu2204-x86_64` |

## Bundling

`pnpm app:build` runs `pnpm sidecars` and then
`tauri build --config src-tauri/tauri.sidecars.conf.json`. Only that merged config lists
`externalBin`: Tauri's build script fails when a listed binary is missing, so keeping it out
of `tauri.conf.json` lets `cargo build`/`test`/clippy and `pnpm app:dev` work without the
download. Installed apps find the tools next to the app executable; debug builds also look in
`src-tauri/binaries/`.

Measured on Windows with tools 100.19.1 (about 57 MB uncompressed): the NSIS installer is
21.4 MiB and the MSI 28.6 MiB.

On Linux the tools link `libgssapi_krb5.so.2`; the `.deb` declares `libgssapi-krb5-2` and the
`.rpm` `krb5-libs`.

## Running

`tools::tool_command` starts a binary with `tokio::process`: stdin closed (CSV imports pipe it), stdout/stderr
piped, killed when dropped (job cancelled or app closed), and without a console window on
Windows. The shell plugin is not used, so the webview has no permission to start processes.
Credentials never appear on the command line (a temporary `--config` file readable only by
the user), and the command shown to the user is redacted. The tools
print their whole connection string, password included, when they cannot connect ("failed to
connect to mongodb://user:password@…"), so `run_tool` passes every output line through the
connection's `SecretMask` (its secrets as typed and percent-encoded, plus any URI password)
before it is logged or parsed.

## Updating the tools version

1. Change `version` in `scripts/sidecars.lock.json`.
2. Run `pnpm sidecars --update-checksums --force`, then `pnpm format`, and review the diff.
3. Run `pnpm test:rust` (`tests/tools.rs` checks every tool reports the pinned version; the
   dump/restore tests exercise them against MongoDB).
4. Add a `Changed` entry to `CHANGELOG.md`.
