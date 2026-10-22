# 0008. Encrypted connection export

- Status: Accepted
- Date: 2026-10-22

## Context

Users move saved connections between machines and share them with teammates. The settings
are harmless, but passwords, AWS session tokens, TLS key passwords and SSH passphrases are not.
Exporting them in plain text would undo ADR 0007 (secrets only in the keychain).

## Decision

- Exports are JSON files: `{ format: "ripemongo-connections", version: 1, connections, secrets }`.
- By default `secrets` is `null`: only settings are exported.
- When the user chooses "Include passwords", all secrets of the exported connections are
  serialized as a map `connectionId → ConnectionSecrets` and encrypted:
  - key derivation: **Argon2id** (19 MiB, 2 passes, 1 lane; OWASP recommendation), random
    16-byte salt, 32-byte key;
  - cipher: **XChaCha20-Poly1305** with a random 24-byte nonce (AEAD, so tampering is detected).
  - All parameters are stored next to the ciphertext so they can be raised later.
- Import validates the format, version, size (≤ 10 MiB) and KDF parameters (upper bounds, so a
  crafted file cannot exhaust memory), assigns **new ids** to every imported connection and
  stores secrets in the keychain only if the password is supplied and correct. A wrong password
  and a modified file are indistinguishable; nothing is saved in either case.
- The export password must be at least 8 characters (UI rule).
- Crates: `argon2` 0.5, `chacha20poly1305` 0.10, `base64` 0.22 (stable APIs; newer pre-releases
  were avoided).

## Consequences

- Shared files are safe at rest as long as the password is strong; there is no recovery if the
  password is lost (the connections themselves still import).
- Importing the same file twice creates duplicates by design (never overwrites).
