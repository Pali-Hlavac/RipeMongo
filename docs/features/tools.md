# Tools: dump (and later restore, import, export, copy)

## What it does

- **Dump** a whole server, one database or one collection with the bundled `mongodump`, from
  the sidebar's ⋯ menus: connection → "Dump all databases…", database → "Dump database…",
  collection → "Dump collection…" (not on views).
- Output as a **folder** (`--out`, one sub-folder per database) or a **single archive file**
  (`--archive`), optionally **gzip** compressed. Paths come from native folder/save dialogs or
  can be typed (they must be absolute).
- Options per scope (others are hidden and never sent):
  - **Collection:** a **query filter** (`--query`) in the same syntax as the documents filter
    (JSON, Extended JSON or shell syntax such as `{ total: { $gt: 5 } }`); the backend parses it
    and passes canonical Extended JSON to the tool.
  - **Database:** a **checklist of collections** (views are not listed); unticked ones become
    `--excludeCollection`, so collections created later are still included when a saved dump
    runs again. **Name prefixes** to leave out (`--excludeCollectionsWithPrefix`).
  - **Whole server:** **point-in-time snapshot** (`--oplog`, replica sets only); the summary
    adds the number of oplog entries.
  - **Database and server:** **collections at a time** (`--numParallelCollections`, 1–16,
    blank keeps the tool's default of 4).
- **Saved dumps:** tick "Save for one-click re-runs" and name it; "Save" only saves, "Save and
  start" also runs it. The **Saved dumps** dialog (palette "Saved dumps", or the connected
  connection's ⋯ menu) lists them with scope, connection, destination, options and last run,
  and offers **Run** (connects first if needed), **Edit** (opens the dump dialog with the saved
  settings; "Save" returns to the list) and **Delete** (simple confirmation; files already
  written stay). A re-run writes to the same destination.
- The dump runs as a **background job** ([background-jobs.md](../architecture/background-jobs.md)):
  the jobs panel opens with live progress ("300 of 1,200 documents"), the collection being
  written, Cancel, and on completion a summary ("Dumped 2 collections (252 documents) to …")
  or the tool's error. A toast reports the end even when the panel is closed. Jobs started
  from a saved dump are titled "Dump shop (Nightly)".
- **Details and log** shows the equivalent command line (copyable, without passwords) and
  everything the tool printed (copyable).
- The **status bar** shows "Jobs" or "N running"; the palette has "Show background jobs".
- The About dialog lists the bundled tools version; if `mongodump` is missing the dump dialog
  says so and cannot start.

Planned next (M4): restore, JSON/CSV import and export, and copying between connections.

## How it works

1. `DumpDialog` (`src/features/tools/`) keeps the form in `DumpFormValues`, validates the path,
   parallelism and name, and builds a `DumpRequest` with `buildDumpRequest` (drops options
   outside the scope). `useSubmitDump` calls `start_dump`, or `save_dump_profile` followed by
   `run_dump_profile` when the dump is saved.
2. `start_dump` asks `ConnectionManager::tool_connection` for the live connection's settings
   (through its SSH tunnel, if any; the tunnel stays open until the job ends), validates the
   request (`DumpRequest::args`: scope rules, absolute path, parsable query, 1–16 in parallel),
   writes the connection string to a temporary `--config` file and starts the job.
3. The job estimates the document total (metadata counts, minus excluded collections; with a
   query, a `countDocuments` limited to 10 seconds), runs `mongodump`, parses its output into
   progress and returns a summary. See [sidecars.md](../architecture/sidecars.md) for where
   the binaries come from.
4. Saved dumps live in the `dump_profiles` module (`dump-profiles.json`). The list joins the
   current connection names. `SavedDumpsDialog` receives `ensureConnected` from the app
   (`useEnsureConnected` in connections), so the tools feature does not import connections.
5. Dialogs that open another dialog (dump → jobs panel, saved dumps → dump dialog, palette →
   any dialog) run that action from `onCloseAutoFocus` via `useAfterDialogClose`, so Radix's
   focus return cannot close the new dialog.

## Key files

| Area     | Files                                                                                                                   |
| -------- | ----------------------------------------------------------------------------------------------------------------------- |
| Backend  | `src-tauri/src/tools/{dump/,run.rs,credentials.rs,display.rs}`, `src-tauri/src/dump_profiles/`, `src-tauri/src/jobs/`   |
| Frontend | `src/features/tools/` (dump dialog, options, saved dumps), `src/features/jobs/` (panel, events, log)                    |
| Tests    | `src-tauri/tests/dump.rs`, `dump/args.rs`, `dump_profiles/tests.rs`, `DumpDialog.test.tsx`, `SavedDumpsDialog.test.tsx` |

## Edge cases and limitations

- A connection must be open to dump; saved dumps connect first. Disconnecting during a dump
  does not stop it.
- Dumping into an existing folder overwrites files of the same collections; a saved dump to an
  archive file replaces that file on every run.
- mongodump cannot leave out whole databases, so a server dump has no include/exclude.
- The oplog option needs a replica set (not a standalone server or a sharded cluster); the
  tool's error explains it otherwise.
- The total is an estimate; the bar never goes backwards and the final counts come from
  `mongodump` itself. Whole-server dumps also count `admin` system collections.
- A query filter is visible in the process list like any other option (never credentials).
- Authentication methods `mongodump` does not support fail with its own message.
- Jobs are not kept after the app quits; quitting stops running tools.

## Testing

- `cargo test --test dump` (Docker + `pnpm sidecars`): SCRAM auth (password with `@`), a
  database dump leaving out a prefix with 2 collections at a time, a shell-syntax query into a
  gzip archive (total and summary counts), an oplog dump of a replica set, and a failing
  dump's error.
- `cargo test tools::` arguments and scope rules, parsing (oplog lines), quoting;
  `cargo test dump_profiles::` the store; `cargo test jobs::` registry behavior.
- `pnpm test src/features/jobs src/features/tools src/features/command-palette`.
