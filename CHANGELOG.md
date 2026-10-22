# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project
adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Project scaffold: Tauri 2 + React 19 + TypeScript (strict) + Vite + Tailwind CSS 4.
- Typed IPC layer: Rust commands exported to TypeScript with tauri-specta; a single
  `AppError { code, message, hint }` error model; `unwrap`/`call` client helpers.
- Strict Tauri capabilities: each app command must be allow-listed explicitly.
- Settings persisted as JSON in the platform config directory (atomic writes).
- App shell: resizable sidebar, tab bar (keyboard navigable), status bar.
- Light / dark / system theme, persisted and following OS changes live.
- Command palette (Ctrl/Cmd+K) and tab shortcuts (close, next, previous).
- About dialog with version and platform.
- Tooling: ESLint (type-aware, a11y, max 300 lines per file), Prettier, rustfmt, clippy
  (`-D warnings`, no `unwrap`), husky pre-commit hook, commitlint (Conventional Commits).
- CI workflow: lint, type-check and tests on Linux, Windows and macOS.
- Documentation: `CLAUDE.md`, `docs/` skeleton and ADRs 0001–0007.
- Connections (milestone 2):
  - saved connections with folders, favorites and color labels; create, edit, duplicate, delete;
  - connection string and form kept in sync both ways (`mongodb://` and `mongodb+srv://`);
  - authentication: SCRAM-SHA-1/256, X.509, LDAP (PLAIN), AWS IAM, OIDC environment providers;
  - TLS with CA file, client certificate/key (optionally encrypted) and relaxed verification;
  - SSH tunnels with password or private key, known_hosts verification (trust on first use);
  - test connection, connect/disconnect, several live connections at once;
  - connection overview tab with server version, topology and members;
  - import/export of connections, optionally with passwords encrypted by a password;
  - command-palette and welcome-screen actions for connections.
- Integration tests against MongoDB 8 in Docker (testcontainers).
- ADR 0008 (encrypted connection export) and ADR 0013 (SSH tunnels); `docs/roadmap.md`.

### Security

- Connection secrets are stored only in the OS keychain and never sent back to the webview;
  connection strings are redacted in logs and error messages.

### Not yet implemented

- Browsing databases, collections and documents (milestone 3). The connection overview tab
  says so.
- Interactive browser OIDC sign-in and Kerberos (GSSAPI) authentication.
- SSH tunnels have not yet been verified against a real SSH server in automated tests.

<!-- The first release will be tagged 0.1.0. -->
