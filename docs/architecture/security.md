# Security

## Principles

1. The webview is untrusted. It can only call commands that the ACL allows, and all
   database, filesystem and process access happens in Rust.
2. Secrets live only in the OS keychain (milestone 2), never in config files, logs or error
   messages.
3. Minimal permissions: nothing is enabled "just in case".

## Tauri capabilities (implemented)

- `src-tauri/build.rs` declares every app command in `APP_COMMANDS`. Tauri generates an
  `allow-<command>` permission for each, and unlisted commands are rejected.
- `src-tauri/capabilities/default.json` grants the `main` window only `core:event:default`
  plus the explicit `allow-*` command permissions. No filesystem, shell or HTTP plugins are
  enabled.

## Content Security Policy (implemented)

Defined in `tauri.conf.json`:
`default-src 'self'`, `script-src 'self'`, `style-src 'self' 'unsafe-inline'` (Radix and
Monaco inject styles), `img-src 'self' data: blob:`, `font-src 'self' data:`,
`worker-src 'self' blob:` (Monaco workers), `connect-src ipc: http://ipc.localhost`.
No remote origins are allowed; all assets are bundled. `freezePrototype` is enabled.

## Production hardening (implemented)

`src/shared/lib/native-feel.ts` disables the webview context menu (except in editable fields)
and reload/print shortcuts in production builds.

## Secrets and redaction (planned, milestone 2)

- Passwords, SSH passphrases and key passphrases are stored with the `keyring` crate under
  service `com.ripemongo.app` and an opaque per-connection key.
- Saved connection files contain only a reference to the keychain entry.
- Connection strings are passed through a `redact()` helper before logging or display
  (`mongodb://user:****@host`).
- Exported connections either omit secrets or encrypt them with a user password (ADR 0008).

## Reporting vulnerabilities

Until a public repository exists, report issues privately to the maintainers.
