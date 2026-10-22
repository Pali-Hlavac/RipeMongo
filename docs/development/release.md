# Release

> **Status:** versioning rules apply now. The release workflow (build, sign, notarize,
> publish) is planned for milestone 8.

## Versioning

- [Semantic Versioning](https://semver.org). The version lives in `package.json`,
  `src-tauri/Cargo.toml` and `src-tauri/tauri.conf.json`; keep all three equal.
- `CHANGELOG.md` follows Keep a Changelog. On release, rename `[Unreleased]` to
  `[x.y.z] - YYYY-MM-DD` and start a new `[Unreleased]`.
- The first release will be `0.1.0`.

## Planned release workflow

`.github/workflows/release.yml`, triggered by a `v*` tag:

1. Matrix: `windows-latest` (x64), `macos-13` (x64), `macos-14` (arm64), `ubuntu-22.04` (x64).
2. Fetch and verify sidecars for the target triple (`pnpm sidecars`).
3. `tauri-action` builds the installers (NSIS/MSI, DMG/app, AppImage/deb).
4. Sign and notarize, then upload to a draft GitHub release.

## Signing secrets (TODO: to be provided by the maintainer)

| Platform | Secrets                                                                                                                                   |
| -------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| macOS    | `APPLE_CERTIFICATE`, `APPLE_CERTIFICATE_PASSWORD`, `APPLE_SIGNING_IDENTITY`, `APPLE_ID`, `APPLE_PASSWORD` (app-specific), `APPLE_TEAM_ID` |
| Windows  | Code-signing certificate (`WINDOWS_CERTIFICATE`, `WINDOWS_CERTIFICATE_PASSWORD`) or Azure Trusted Signing credentials                     |
| Updater  | `TAURI_SIGNING_PRIVATE_KEY`, `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` (if the auto-updater is enabled)                                        |
