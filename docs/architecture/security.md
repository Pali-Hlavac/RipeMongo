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
- `src-tauri/capabilities/default.json` grants the `main` window only `core:event:default`,
  the explicit `allow-*` command permissions and `dialog:allow-open` / `dialog:allow-save`.
  No filesystem, shell or HTTP plugins are enabled.

## Content Security Policy (implemented)

Defined in `tauri.conf.json`:
`default-src 'self'`, `script-src 'self'`, `style-src 'self' 'unsafe-inline'` (Radix and
Monaco inject styles), `img-src 'self' data: blob:`, `font-src 'self' data:`,
`worker-src 'self' blob:` (Monaco workers), `connect-src ipc: http://ipc.localhost`.
No remote origins are allowed; all assets are bundled. `freezePrototype` is enabled.
Monaco assigns `toString` on a few plain objects, which throws under a frozen
`Object.prototype`; `patches/monaco-editor@*.patch` (pnpm patch) rewrites those to
`Object.defineProperty`, and `scripts/check-monaco-frozen-prototype.mjs` (part of `pnpm lint`)
fails if a Monaco upgrade adds new ones.

## Production hardening (implemented)

`src/shared/lib/native-feel.ts` disables the webview context menu (except in editable fields)
and reload/print shortcuts in production builds.

## Secrets and redaction (implemented)

- Passwords, AWS session tokens, TLS key passwords, SSH passwords and key passphrases are
  stored with the `keyring` crate under service `com.ripemongo.app`, key
  `connection/<id>/<secret>`. `connections.json` never contains them.
- Secret values never travel to the webview: the UI receives `StoredSecrets` booleans and sends
  `SecretUpdates` (`keep`/`set`/`clear`). The only exception is a password the user pastes
  inside a connection string, which the parser hands back so it can go into the secret field.
- Displayed connection strings are built without secrets. Driver errors pass through
  `redact_uri` (`mongodb://user:****@host`) before logging or display.
- Exported connections either omit secrets or encrypt them with a user password (ADR 0008).
- SSH host keys are verified against known_hosts with trust on first use; changed keys are
  rejected (ADR 0013).
- Query history and favorites (`query-history.json`) stay on this computer; they may contain
  values typed into filters, never credentials.
- The bundled tools receive the connection string (with password) in a temporary YAML file
  passed as `--config`, created readable only by the user (`0600` on Unix, the per-user temp
  folder on Windows) and deleted when the tool exits, so it never appears in a process list.
  The command shown in the app is built without secrets. Tools are started from Rust only;
  the webview has no shell or process permission.
- Import/export paths come from native dialogs (`dialog:allow-open`, `dialog:allow-save`);
  imports are capped at 10 MiB.

## Reporting vulnerabilities

Until a public repository exists, report issues privately to the maintainers.
