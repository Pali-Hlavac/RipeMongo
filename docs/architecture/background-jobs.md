# Background jobs

> **Status: design only. Implementation is planned for milestone 4.** Nothing in this
> document exists in code yet.

Long-running work (dump, restore, import, export, copy, schema sampling) must not block a
command call or the UI, must report progress, and must be cancellable.

## Design

- A `jobs` module owns a `JobRegistry` (managed state): `HashMap<JobId, JobHandle>` behind a
  mutex. `JobHandle` holds a `tokio_util::sync::CancellationToken`, the job kind, and status.
- Starting a job is a normal command (e.g. `start_dump(profile)`) that spawns a tokio task,
  registers it and returns a `JobId` immediately.
- Jobs emit typed tauri-specta events:
  - `JobProgress { jobId, phase, done, total?, message? }`, throttled (at most ~10/s).
  - `JobLog { jobId, line, stream }` for sidecar stdout/stderr.
  - `JobFinished { jobId, outcome: Succeeded | Failed(AppError) | Cancelled }`.
- `cancel_job(jobId)` triggers the token; sidecar jobs kill the child process.
- The frontend subscribes once (`events.jobProgress.listen`) and writes into a Zustand jobs
  store, which drives progress bars and a global jobs panel.
- Jobs are kept in memory only; finished jobs stay listed until dismissed.
