# 0002. Rust owns all database access

- Status: Accepted
- Date: 2026-10-22

## Context

A webview cannot open raw TCP sockets to MongoDB, and putting credentials in JavaScript widens
the attack surface. We also need TLS client certificates, SSH tunnels, the keychain and child
processes, all of which are native concerns.

## Decision

The official `mongodb` Rust driver (3.x) with `bson` is the only path to the database. The
frontend talks to Rust exclusively through typed Tauri commands and events.

## Consequences

- One security boundary to reason about. Credentials never reach the webview.
- Results must be serialized over IPC, so we stream and paginate (ADR 0011) instead of
  shipping whole collections.
- BSON values cross IPC as Extended JSON (ADR 0012).
