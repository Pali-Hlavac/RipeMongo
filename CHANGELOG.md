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

### Not yet implemented

- Connections and everything that requires a database (milestone 2 onward). The sidebar shows
  a clearly labelled placeholder.

<!-- The first release will be tagged 0.1.0. -->
