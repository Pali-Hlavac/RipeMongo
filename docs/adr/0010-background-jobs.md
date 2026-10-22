# 0010. Background jobs as cancellable tokio tasks with throttled events

- Status: Accepted
- Date: 2026-10-22

## Context

Dump, restore, import, export and copy can run for minutes or hours. A command call must not
wait for them, the user must see progress and the tool's output, be able to cancel, and keep
working meanwhile. Several jobs can run at once.

## Decision

- A `jobs` module owns a `JobRegistry` (Tauri managed state): an in-memory map of job id →
  snapshot (`JobInfo`), log (last 10,000 lines) and a `CancellationToken`.
- A feature command (for example `start_dump`) validates its input, then calls
  `JobRegistry::start(spec, work)`, which runs `work` as a tokio task and returns the first
  snapshot immediately. `work` gets a `JobContext` to report progress, append log lines and
  observe cancellation; it returns a one-line summary or an `AppError`.
- Changes are published through a `JobEvents` sink. The app's sink emits the typed
  tauri-specta events `JobUpdated { job }` and `JobLogged { jobId, lines }`. A flusher task
  publishes at most every 200 ms per job, so a chatty tool cannot flood the webview.
- `cancel_job` triggers the token; tool runs kill the child process (which is also killed if
  the task is dropped). A job that fails after a cancel ends as `cancelled`; one that
  completed before noticing ends as `succeeded`.
- Commands `list_jobs`, `get_job_log`, `cancel_job`, `dismiss_job`. Finished jobs stay listed
  until dismissed; the registry forgets the oldest beyond 50.
- **Frontend:** job state is server state, so it lives in TanStack Query (`["jobs", "list"]`,
  `["jobs", "log", id]`). `useJobEvents` (mounted once) patches these caches from events and
  shows a toast when a job ends. Only the panel's open state is in Zustand.
- Jobs are kept in memory only; quitting the app stops running tools.

## Consequences

- Unit tests drive the registry with an in-memory `JobEvents` sink; no Tauri runtime needed.
- A job holds what it needs to finish (for tools: a `ToolConnection`, which keeps the SSH
  tunnel open even if the user disconnects meanwhile).
- Jobs do not survive a restart, and there is no queue: every job starts immediately.
- Events can arrive before the first `list_jobs` result; the cache is corrected by the next
  update (at most 200 ms later) or the final one.
