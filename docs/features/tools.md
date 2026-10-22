# Tools: dump (and later restore, import, export, copy)

## What it does

- **Dump** a whole server, one database or one collection with the bundled `mongodump`, from
  the sidebar's ⋯ menus: connection → "Dump all databases…", database → "Dump database…",
  collection → "Dump collection…" (not on views).
- Output as a **folder** (`--out`, one sub-folder per database) or a **single archive file**
  (`--archive`), optionally **gzip** compressed. Paths come from native folder/save dialogs or
  can be typed (they must be absolute).
- The dump runs as a **background job** ([background-jobs.md](../architecture/background-jobs.md)):
  the jobs panel opens with live progress ("300 of 1,200 documents"), the collection being
  written, Cancel, and on completion a summary ("Dumped 2 collections (252 documents) to …")
  or the tool's error. A toast reports the end even when the panel is closed.
- **Details and log** shows the equivalent command line (copyable, without passwords) and
  everything the tool printed (copyable).
- The **status bar** shows "Jobs" or "N running"; the palette has "Show background jobs".
- The About dialog lists the bundled tools version; if `mongodump` is missing the dump dialog
  says so and cannot start.

Planned next (M4): query filter, oplog, include/exclude, parallelism and saved dump profiles;
then restore, JSON/CSV import and export, and copying between connections.

## How it works

1. `DumpDialog` (`src/features/tools/`) builds a `DumpRequest` and calls `start_dump`.
2. `start_dump` asks `ConnectionManager::tool_connection` for the live connection's settings
   (through its SSH tunnel, if any; the tunnel stays open until the job ends), validates the
   request, writes the connection string to a temporary `--config` file and starts the job.
3. The job estimates the document total, runs `mongodump`, parses its output into progress and
   returns a summary. See [sidecars.md](../architecture/sidecars.md) for where the binaries
   come from.

## Key files

| Area     | Files                                                                                   |
| -------- | --------------------------------------------------------------------------------------- |
| Backend  | `src-tauri/src/tools/{dump/,run.rs,credentials.rs,display.rs}`, `src-tauri/src/jobs/`   |
| Frontend | `src/features/tools/` (dump dialog), `src/features/jobs/` (panel, events, log)          |
| Tests    | `src-tauri/tests/dump.rs`, `jobs/tests.rs`, `DumpDialog.test.tsx`, `JobsPanel.test.tsx` |

## Edge cases and limitations

- A connection must be open to dump. Disconnecting during a dump does not stop it.
- Dumping into an existing folder overwrites files of the same collections.
- The total is an estimate from metadata; the bar never goes backwards and the final counts come
  from `mongodump` itself.
- Authentication methods `mongodump` does not support fail with its own message.
- Jobs are not kept after the app quits; quitting stops running tools.

## Testing

- `cargo test --test dump` (Docker + `pnpm sidecars`): folder and gzip archive dumps with SCRAM
  auth (password with `@`), progress totals and summary, and a failing dump's error.
- `cargo test jobs::` registry behavior; `cargo test tools::` arguments, parsing, quoting.
- `pnpm test src/features/jobs src/features/tools`.
