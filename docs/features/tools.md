# Tools: dump, restore, export (later import and copy)

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
    runs again. **Name prefixes** to leave out (`--excludeCollectionsWithPrefix`); collections
    they match show as unticked and disabled ("left out by prefix").
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
- The About dialog lists the bundled tools version; if `mongodump` or `mongorestore` is missing
  the dialog says so and cannot start.
- **Restore** a dump into a connected server with the bundled `mongorestore`: connection ⋯ →
  "Restore…". Pick a dump **folder** (`--dir`) or **archive file** (`--archive`); RipeMongo
  reads it first (`inspect_dump`) and shows its databases and collections (views marked; the
  oplog noted). gzip is detected, never asked.
  - **What to restore:** tick databases and collections (a partly selected database shows a
    dash); unticked ones become `--nsExclude` (escaped, so names with `*` or `$` match
    literally).
  - **Restore as:** a new name per database (`--nsFrom=shop.* --nsTo=copy.*`).
  - **Drop each collection before restoring it** (`--drop`), confirmed by typing the
    connection name. Without it, documents whose `_id` exists are skipped and counted.
  - **Replay the oplog** (`--oplogReplay`, default on for dumps with an oplog), only for a full
    restore without new names; mongorestore refuses it otherwise.
  - **Dry run** (`--dryRun --verbose=1`): the summary lists what would be restored.
  - **Collections at a time** (1–16).
  - Progress: folder dumps know each data file's size, so the bar shows bytes read out of the
    total ("5.4 MB of 12.7 MB"), with the collection in progress and its percentage. Archives
    give no sizes up front, so the bar is indeterminate and counts documents of finished
    collections, with the size read so far. The summary: "Restored 300,002 documents into 2
    collections.", plus replayed oplog entries and documents that failed (duplicates).
  - When a restore ends, the sidebar reloads that connection's databases and collections.

- **Export** a collection or view to a file with the bundled `mongoexport`: collection ⋯ →
  "Export to JSON or CSV…", or **Export** in a documents tab's toolbar, which carries the tab's
  applied filter, sort, skip and limit (not its projection; a note says so).
  - **JSON** (Extended JSON, relaxed by default): one document per line or one array
    (`--jsonArray`), indented (`--pretty`), canonical types (`--jsonFormat=canonical`).
  - **CSV**: the ticked fields become columns (`--type=csv --fields`); field names as the first
    line unless switched off (`--noHeaderLine`). Arrays and nested documents are written as
    JSON, `ObjectId` as `ObjectId(…)`, dates in ISO 8601.
  - **Fields**: a checklist from a random sample of up to 1,000 documents (`sample_fields`,
    `$sample`, 10 s limit). JSON lists top-level fields (mongoexport keeps whole top-level
    fields in JSON even for a dotted name); CSV lists dotted paths with nested documents
    expanded (up to 4 levels). With every JSON field ticked the export has no `--fields` at
    all, so fields the sample missed are kept. "Other fields" adds names the sample did not
    find.
  - **Query**: filter and sort in the documents syntax (filter passed as canonical Extended
    JSON, sort as relaxed JSON because `--sort` refuses `$numberInt`), skip and limit.
  - The file comes from a native save dialog (`orders.json` / `orders.csv` suggested; the
    extension follows the format). Missing folders are created.
  - Progress follows mongoexport's bar (documents done of the total); the summary is
    "Exported 1,204 documents to …".

Planned next (M4): JSON/CSV import, and copying between connections.

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
5. `RestoreDialog` reads the chosen path with `useDumpContents` (`inspect_dump`: folder
   layout, or the archive prelude read through gzip if needed, `tools/restore/archive.rs`)
   and builds a `RestoreRequest`. `start_restore` reads the dump again (gzip, oplog), checks the
   request (`RestoreRequest::args`: absolute path, valid new names, oplog only for a full
   restore) and runs `mongorestore` in a job; `RestoreProgress` parses its output.
6. Dialogs that open another dialog (dump → jobs panel, saved dumps → dump dialog, palette →
   any dialog) run that action from `onCloseAutoFocus` via `useAfterDialogClose`, so Radix's
   focus return cannot close the new dialog. The dump and restore dialogs scroll their fields
   and keep errors and buttons in a fixed footer (`<Button form={formId}>`).
7. `useJobEvents(onFinished)` lets the app react to finished jobs: `App` reloads the catalog
   of the restore's connection.
8. `ExportDialog` (store `useExportDialog`, `store/transfer.ts`) samples fields with
   `useSampledFields`, keeps the form in `ExportFormValues` (unticked fields, so everything
   starts ticked) and builds an `ExportRequest` with `buildExportRequest`. `start_export`
   validates it (`ExportRequest::args`: absolute path, fields for CSV, no commas in field
   names, parsable filter and sort) and runs `mongoexport`; `ExportProgress` reads its bar
   and "exported N records".

## Key files

| Area     | Files                                                                                                                                                                               |
| -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Backend  | `src-tauri/src/tools/{dump/,restore/,export/,run.rs,credentials.rs,display.rs,text.rs}`, `src-tauri/src/dump_profiles/`, `src-tauri/src/jobs/`, `src-tauri/src/documents/fields.rs` |
| Frontend | `src/features/tools/` (dump, restore and export dialogs, saved dumps), `src/features/jobs/` (panel, events, log)                                                                    |
| Tests    | `src-tauri/tests/{dump,restore,export}.rs`, `tools/*/tests.rs`, `dump_profiles/tests.rs`, `*Dialog.test.tsx`, `lib/*.test.ts`                                                       |

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
- Restore: `admin.system.version` is never offered (mongorestore skips it). A folder of one
  database (`dump/shop`) is refused with a hint to pick the folder above it. Renaming works per
  database, not per collection. Restoring without drop into existing collections keeps the
  existing documents with the same `_id`.
- Restoring from an archive has no total in advance, so its bar is indeterminate; the
  collection in progress and the size read so far move.
- Export: field names containing a comma cannot be chosen (`--fields` is comma-separated).
  Exports of views work; the sample of a very large view may hit the 10 second limit, in
  which case typed fields still work. A small export reports only its final count.
- Authentication methods the tools do not support fail with their own message.
- Jobs are not kept after the app quits; quitting stops running tools.

## Testing

- `cargo test --test dump` (Docker + `pnpm sidecars`): SCRAM auth (password with `@`), a
  database dump leaving out a prefix with 2 collections at a time, a shell-syntax query into a
  gzip archive (total and summary counts), an oplog dump of a replica set, and a failing
  dump's error.
- `cargo test --test restore` (Docker + `pnpm sidecars`): reads real gzip folder and archive
  dumps (collections, a view, the oplog), restores into another database without one
  collection, again with duplicates reported, with drop, a dry run, and a point-in-time
  restore with oplog replay.
- `cargo test --test export` (Docker + `pnpm sidecars`): sampled fields and paths; JSON lines
  with filter, descending sort, skip, limit and fields; a pretty canonical array of a view; CSV
  with nested paths with and without the header; a created folder; a path that is a folder
  fails with the tool's reason.
- `cargo test tools::` arguments and scope rules, parsing (oplog lines, restore output, the
  archive prelude, dump folders), quoting;
  `cargo test dump_profiles::` the store; `cargo test jobs::` registry behavior.
- `pnpm test src/features/jobs src/features/tools src/features/command-palette`.
