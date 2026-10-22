# 0006. Single serializable error model

- Status: Accepted
- Date: 2026-10-22

## Context

Errors must be precise inside Rust (for logs and tests) and helpful in the UI ("what
happened, what to do next"), and the frontend should handle them uniformly.

## Decision

- Each domain defines a `thiserror` enum with technical detail.
- `impl From<DomainError> for AppError` logs the technical error with `tracing` and maps it to
  `AppError { code: ErrorCode, message, hint: Option<String> }`, which is the only error type
  that crosses IPC.
- `ErrorCode` is a closed enum (`INTERNAL`, `IO`, `INVALID_DATA`, more per milestone). The
  frontend adds `IPC_FAILURE` for framework rejections.
- The TS client converts every failure into `IpcError`. Queries render `ErrorState`, and
  mutations show a toast via the global `MutationCache.onError`.

## Consequences

- UI copy for errors lives in Rust next to the cause, so it is reviewed with the code.
- New codes require updating the enum and docs/architecture/ipc.md.
