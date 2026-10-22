# 0007. Secrets only in the OS keychain

- Status: Accepted
- Date: 2026-10-22

## Context

Connection passwords, SSH passwords and key passphrases are high-value secrets. Plain-text
config files (as some GUI clients use) leak through backups, dotfile repos and support bundles.

## Decision

- Store secrets with the `keyring` crate (Windows Credential Manager, macOS Keychain, Linux
  Secret Service), service name = the app identifier `com.ripemongo.app`.
- Saved connection documents store connection fields without secrets plus an opaque keychain
  reference.
- Connection strings shown in logs, errors or "equivalent CLI command" output are redacted.
- On Linux without a Secret Service provider, the app explains the problem and offers
  "don't save password" instead of silently falling back to plain text.

## Consequences

- Moving to another machine requires re-entering secrets, or the encrypted export (ADR 0008).
- Keychain prompts may appear on macOS the first time a secret is read.
