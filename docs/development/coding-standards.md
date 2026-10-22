# Coding standards

These rules are enforced by tooling where possible. `pnpm check` runs everything CI runs.

## General

- **Small files:** soft limit 200 non-blank lines, hard limit 300
  (`scripts/check-file-size.mjs`, plus ESLint `max-lines`). Split by responsibility.
- **Single responsibility** per file and function. Short, well-named functions.
- **No dead or commented-out code, no magic numbers** (name constants), no copy-paste.
- **Comments:** a short top-of-file comment on every non-trivial file; doc comments (TSDoc
  `/** */`, Rust `///`) on exported items. Explain _why_, not _what_.

## TypeScript / React

- `strict` plus `noUncheckedIndexedAccess`. No `any` (use `unknown` and narrow). No `!`
  non-null assertions without an explanatory comment (ESLint error by default).
- `import type` for type-only imports. Path alias `@/` maps to `src/`.
- Components are function components with named exports. One component per file, except
  small private helpers.
- Feature code imports other features only through their `index.ts`.
- Accessibility: every control has an accessible name, a visible focus ring, and is
  keyboard-operable. `jsx-a11y` runs in ESLint.
- Formatting: Prettier (100 columns, Tailwind class sorting).

## Rust

- `cargo fmt`, `cargo clippy --all-targets -- -D warnings`.
- `unwrap()` is denied outside tests (`clippy::unwrap_used`); `expect()` warns. Use `?` and
  typed errors. Document any invariant that justifies an exception.
- `unsafe` is forbidden.
- One `thiserror` enum per domain; convert to `AppError` at the boundary.
- `tracing` for logs. Never log secrets; redact connection strings.

## Commits

[Conventional Commits](https://www.conventionalcommits.org/), checked by commitlint:
`feat(connections): add SSH tunnel support`. Types: `feat`, `fix`, `docs`, `refactor`,
`test`, `chore`, `ci`, `build`, `perf`, `style`, `revert`.

## Definition of done

Code, tests, docs (`docs/features/*` and the relevant architecture doc), `CHANGELOG.md`
entry, `pnpm check` green.
