# Getting started

## Prerequisites (all platforms)

| Tool    | Version         | Notes                                                        |
| ------- | --------------- | ------------------------------------------------------------ |
| Node.js | ≥ 22.12         | `engines` in `package.json`                                  |
| pnpm    | 9.x             | `corepack enable` or `npm i -g pnpm@9`                       |
| Rust    | stable (≥ 1.85) | via [rustup](https://rustup.rs), with `rustfmt` and `clippy` |
| Docker  | recent          | only for integration tests (milestone 2+)                    |

```sh
rustup component add rustfmt clippy
```

### Windows

- Microsoft C++ Build Tools ("Desktop development with C++").
- WebView2 runtime (preinstalled on Windows 10 21H2+ and Windows 11).

### macOS

- Xcode Command Line Tools: `xcode-select --install`.

### Linux (Debian/Ubuntu)

```sh
sudo apt-get update
sudo apt-get install -y libwebkit2gtk-4.1-dev build-essential curl wget file \
  libxdo-dev libssl-dev libayatana-appindicator3-dev librsvg2-dev
```

Other distributions: see the [Tauri prerequisites](https://tauri.app/start/prerequisites/).

## First run

```sh
pnpm install        # also installs the git hooks (husky)
pnpm app:dev        # starts Vite on :1420 and the Tauri window
```

The first Rust build takes a few minutes; later builds are incremental.

To run dump, restore, import or export locally, fetch the bundled MongoDB tools once
(about 40–80 MB download, checksum-verified; see
[architecture/sidecars.md](architecture/sidecars.md)):

```sh
pnpm sidecars
```

## Everyday commands

See the command table in [CLAUDE.md](../CLAUDE.md#commands). Before pushing, run:

```sh
pnpm check
```

## Where things are stored at runtime

| Data     | Location                                                                                                                            |
| -------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| Settings | `<app config dir>/settings.json` (identifier `com.ripemongo.app`)                                                                   |
|          | Windows `%APPDATA%\com.ripemongo.app`, macOS `~/Library/Application Support/com.ripemongo.app`, Linux `~/.config/com.ripemongo.app` |
| Secrets  | OS keychain (milestone 2)                                                                                                           |
