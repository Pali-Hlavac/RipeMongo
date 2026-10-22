# Architecture Decision Records

Numbered, immutable records of significant decisions. To change a decision, write a new ADR
that supersedes the old one, and update the old one's status.

| ADR                                                  | Title                                              | Status   |
| ---------------------------------------------------- | -------------------------------------------------- | -------- |
| [0001](0001-use-tauri.md)                            | Use Tauri 2 for the desktop shell                  | Accepted |
| [0002](0002-rust-owns-database-access.md)            | Rust owns all database access                      | Accepted |
| [0003](0003-generate-ipc-types-with-tauri-specta.md) | Generate IPC types with tauri-specta               | Accepted |
| [0004](0004-frontend-stack.md)                       | Frontend stack                                     | Accepted |
| [0005](0005-feature-and-domain-organization.md)      | Organize by feature (FE) and domain module (BE)    | Accepted |
| [0006](0006-error-model.md)                          | Single serializable error model                    | Accepted |
| [0007](0007-secrets-in-os-keychain.md)               | Secrets only in the OS keychain                    | Accepted |
| [0008](0008-encrypted-connection-export.md)          | Encrypted connection export                        | Accepted |
| [0011](0011-paging-documents.md)                     | Page documents with skip/limit plus one            | Accepted |
| [0012](0012-extended-json.md)                        | Canonical Extended JSON on the wire, shell syntax  | Accepted |
| [0013](0013-ssh-tunnels.md)                          | SSH tunnels via russh, forcing a direct connection | Accepted |

Planned: 0009 bundled mongo-tools sidecars ·
0010 background job model ·
0014 no mongosh in v1 · 0015 testing strategy ·
0016 pipeline code export in the frontend.

## Template

```md
# NNNN. Title

- Status: Proposed | Accepted | Superseded by NNNN
- Date: YYYY-MM-DD

## Context

## Decision

## Consequences
```
