# Background jobs

Long-running work (dump, and later restore, import, export, copy and schema sampling) runs as
a background job: it does not block a command call or the UI, reports progress, keeps a log,
and can be cancelled. Decision record: [ADR 0010](../adr/0010-background-jobs.md).

## Backend (`src-tauri/src/jobs/`)

| File          | Role                                                                               |
| ------------- | ---------------------------------------------------------------------------------- |
| `types.rs`    | `JobInfo`, `JobStatus`, `JobKind`, `JobProgress`; events `JobUpdated`, `JobLogged` |
| `registry.rs` | `JobRegistry::start/list/log/cancel/dismiss`, `JobSpec`, `JobEvents` trait         |
| `state.rs`    | Entries, logs, throttled publishing, `JobContext` (progress, log, cancellation)    |
| `events.rs`   | `TauriJobEvents`: emits the events to the webview                                  |
| `commands.rs` | `list_jobs`, `get_job_log`, `cancel_job`, `dismiss_job`                            |
| `tests.rs`    | Registry tests with a recording `JobEvents` sink                                   |

Starting a job is the job's own command, for example `start_dump` in `tools/commands.rs`:

```rust
let connection = manager.tool_connection(&connection_id).await?; // keeps an SSH tunnel open
Ok(start_dump(&jobs, connection_id, connection, request, None)?) // returns the first JobInfo
```

Inside, `jobs.start(spec, |ctx| async move { … })` runs the work on tokio. The work calls
`ctx.progress(…)` and `ctx.log(…)`, watches `ctx.cancellation()`, and returns
`Ok(summary)` or `Err(AppError)`.

- **Throttling:** a flusher task publishes pending changes every 200 ms (`JobUpdated` with the
  full snapshot, `JobLogged` with the new lines).
- **Limits:** 10,000 log lines per job (oldest dropped), 2,000 characters per line, 50 finished
  jobs kept.
- **Statuses:** `running` → `succeeded` | `failed` (with `AppError`) | `cancelled`.

## Running a tool (`src-tauri/src/tools/run.rs`)

`run_tool(ctx, invocation, parser)` starts the binary with `--config=<temp file>` (the
connection string with credentials, see [security.md](security.md)) plus the job's arguments,
forwards stdout and stderr lines into the job log, feeds them (without the tools' timestamp
prefix) to an `OutputParser` for progress, kills the process on cancel, and turns a non-zero
exit into `"<tool> failed: <reason>"`, where the reason is the tool's own `Failed: …` line.

`tools/dump/progress.rs` sums `mongodump`'s per-collection progress bars and
`done dumping <ns> (<n> documents)` lines; the total is estimated beforehand from collection
metadata counts.

## Frontend (`src/features/jobs/`)

- `api/jobs.ts`: `useJobs` (`["jobs", "list"]`, never refetched), `useJobLog`, cancel and dismiss
  mutations.
- `hooks/useJobEvents.ts`: mounted once in `App`; upserts `JobUpdated` into the list cache,
  appends `JobLogged` lines to an open log, toasts when a job ends and refetches its final log.
- `components/`: `JobsButton` (status bar, spinner while jobs run), `JobsPanel` (dialog listing
  jobs with progress, summary or error, Cancel/Remove), `JobLogDialog` (equivalent command and
  log, both copyable).
- `store/panel.ts`: whether the panel is open (UI state only).
