# RipeMongo documentation

Start here. New contributors (human or AI) should read [CLAUDE.md](../CLAUDE.md) first, then
the architecture overview, then the docs for the feature they are touching.

## User guide

- [user-guide/](user-guide/README.md): how to use RipeMongo, written for end users

## Getting started

- [getting-started.md](getting-started.md): set up a dev environment from zero, per OS

## Architecture

| Doc                                                         | Covers                                             |
| ----------------------------------------------------------- | -------------------------------------------------- |
| [overview.md](architecture/overview.md)                     | Layers, request flow, diagrams                     |
| [ipc.md](architecture/ipc.md)                               | Command list, events, error model, type generation |
| [backend-modules.md](architecture/backend-modules.md)       | One section per Rust module                        |
| [frontend-structure.md](architecture/frontend-structure.md) | Features, shared code, state, styling              |
| [background-jobs.md](architecture/background-jobs.md)       | Cancellable jobs with progress events (planned M4) |
| [sidecars.md](architecture/sidecars.md)                     | Bundled mongo-tools: versions, checksums, bundling |
| [security.md](architecture/security.md)                     | Secrets, capabilities, CSP, redaction              |

## Features

See [features/README.md](features/README.md) for the full list with implementation status.

## Development

- [testing.md](development/testing.md): test layers and how to run them
- [coding-standards.md](development/coding-standards.md): rules enforced in review and CI
- [release.md](development/release.md): versioning, signing, notarization, publishing
- [troubleshooting.md](development/troubleshooting.md): known problems and fixes

## Decisions

- [adr/](adr/README.md): Architecture Decision Records

## Plan and roadmap

- [roadmap.md](roadmap.md): approved plan, milestones M1–M8 with checklists, agreed decisions
- [project-brief.md](project-brief.md): the original requirements
