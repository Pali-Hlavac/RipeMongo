# Tools: dump, restore, export, import and copy

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

- **Import** a file with the bundled `mongoimport`: collection ⋯ → "Import from JSON or CSV…"
  (not on views), **Import** in a writable documents tab's toolbar, or database ⋯ → "Import
  into a new collection…" (name suggested from the file name). RipeMongo reads the file's
  start first (`inspect_import_file`, up to 64 KiB for detection, 101 rows for columns):
  - **JSON** (first character `{`) and **JSON arrays** (`[`, `--jsonArray`) go to mongoimport
    as they are (`--file`); Extended JSON types are kept.
  - **Delimited text** (anything else) is read by RipeMongo with the `csv` crate and passed on
    as plain CSV on mongoimport's standard input (`tools/import/feed.rs`). That allows any
    one-character delimiter (detected from the first line among `,` `;` tab `|`, `.tsv` →
    tab; the user can switch), a UTF-8 byte order mark, skipping the header line while using
    typed field names, and leaving columns out. mongoimport alone reads only commas or tabs
    and cannot do the rest.
  - **Columns**: per column "import" (tick), the **field name** (from the header line, or
    `field1…`; a dot nests, `address.city`) and the **type** (`--columnsHaveTypes`): Automatic
    (`auto()`), Text, Whole number 32/64-bit, Decimal number, Exact decimal, True/false, Date
    ISO 8601 with zone (`date_go(2006-01-02T15:04:05Z07:00)`), Date ISO 8601 without zone
    (read as UTC), Date in another format (`date_ms(dd.MM.yyyy)`), Binary base64/hex. Types
    are suggested from the values: Text for numbers with leading zeros (zip codes), True/false
    for `true`/`false`, the date types for `yyyy-MM-dd`, `yyyy-MM-dd HH:mm:ss`, `dd.MM.yyyy` and
    ISO date-times; otherwise Automatic.
  - **Values that do not fit their type** (`--parseGrace`): stop (default), leave the field
    out, leave the row out, import as Automatic. **Leave out empty values**
    (`--ignoreBlanks`).
  - **Existing documents** (`--mode`): insert only (duplicates fail and are counted), replace
    matching documents (upsert) or update their fields (merge), matched on `_id` or on typed
    fields (`--upsertFields`). **Stop at the first failure** (`--stopOnError`). **Drop the
    collection first** (`--drop`), confirmed by typing the collection name.
  - **Speed:** **Insert workers** (`--numInsertionWorkers`, 1–16, blank keeps one), checked in
    the form and in `ImportRequest::args`. Several workers insert batches at the same time, so
    documents no longer arrive in file order. **Skip validation rules**
    (`--bypassDocumentValidation`) shows a warning when ticked; the user needs the
    `bypassDocumentValidation` privilege.
  - Progress is measured in bytes of the file: mongoimport's own bar for JSON files, the bytes
    RipeMongo has read for text files. The summary: "Imported 1,204 documents into
    shop.people.", plus the documents that failed. When an import ends, the sidebar and that
    connection's open documents reload.

- **Copy** a database or collection into another saved connection, or into the same one
  under another name: database ⋯ → "Copy database…", collection ⋯ → "Copy collection…" (not
  on views). `mongodump --archive` writes to its standard output, which RipeMongo pipes into
  `mongorestore --archive` (`tools/pipe.rs`); nothing is written to disk. Indexes, collection
  options, validators and views come along.
  - **Target:** any saved connection (connected when the copy starts, like saved dumps), the
    database name there and, for a collection, the collection name. Defaults: the same names
    in another connection, `<name>_copy` in the same one (until the user types a name).
    Renames become `--nsFrom/--nsTo` (escaped).
  - **Collection:** a query filter, like dumps. **Database:** the collection checklist and
    name prefixes of the dump dialog.
  - **Copy indexes** (off: `--noIndexRestore`). **Replace** (`--drop`): each copied
    collection is dropped in the target first, confirmed by typing the target collection or
    database name. Without it documents are added; an existing `_id` fails and is counted.
  - **Onto itself** is refused before anything starts: the same connection and names (also
    checked in the form), and any target collection whose UUID equals the source's, which
    catches two saved connections to the same server (`--drop` would delete the data being
    read).
  - Progress counts the documents mongodump has read (the pipe keeps it a few kilobytes ahead
    of mongorestore) against the same estimate as a dump, then "Creating the indexes of …".
    The summary uses mongorestore's counts: "Copied 1,204 documents (2 collections) to shop
    on Staging.", plus the documents that could not be written. The sidebar and open
    documents of the target connection reload when a copy ends.

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
   and documents of the connection a restore, import or copy wrote to.
8. `ExportDialog` (store `useExportDialog`, `store/transfer.ts`) samples fields with
   `useSampledFields`, keeps the form in `ExportFormValues` (unticked fields, so everything
   starts ticked) and builds an `ExportRequest` with `buildExportRequest`. `start_export`
   validates it (`ExportRequest::args`: absolute path, fields for CSV, no commas in field
   names, parsable filter and sort) and runs `mongoexport`; `ExportProgress` reads its bar
   and "exported N records".
9. `ImportDialog` (store `useImportDialog`) reads the chosen path with `useImportPreview`
   (`inspect_import_file`; a new delimiter reads it again). Column changes are kept as
   `columnEdits` on top of the preview (`importColumns` merges them), so the preview stays
   query data. `start_import` validates the request (`ImportRequest::args`: collection name,
   absolute path, one-character delimiter, field names without `,` `(` `)` or a leading `$`,
   unique, a date format for custom dates), and for text files hands `run_tool` an `Input`
   closure: `run_tool` then pipes stdin and runs it on a blocking thread through
   `SyncIoBridge`; closing the pipe ends the data. The first log line says what RipeMongo did
   with the file; the displayed command ends with "< (the file's rows as CSV, see the log)".
10. `CopyDialog` (store `useCopyDialog`) lists saved connections (`useCopyConnections`),
    keeps `CopyFormValues` and builds a `CopyRequest`. `useStartCopy` calls the app's
    `ensureConnected` for the target, then `start_copy(connectionId, targetConnectionId,
request)`. The command takes both tool connections, checks the request
    (`CopyRequest::dump_args`/`restore_args`, names from `tools/names.rs`), refuses copying
    onto itself (`ensure_different`: collection UUIDs from `listCollections`) and starts a
    job (kind `copy`, connection = target) that runs `run_pipe` with `CopyProgress`. Each tool
    gets its own `--config` file; the displayed command is `mongodump … | mongorestore …`, and
    log lines are prefixed with the tool's name.

## Key files

| Area     | Files                                                                                                                                                                                                              |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Backend  | `src-tauri/src/tools/{dump/,restore/,export/,import/,copy/,run.rs,pipe.rs,names.rs,credentials.rs,display.rs,text.rs}`, `src-tauri/src/dump_profiles/`, `src-tauri/src/jobs/`, `src-tauri/src/documents/fields.rs` |
| Frontend | `src/features/tools/` (dump, restore, export, import and copy dialogs, saved dumps), `src/features/jobs/` (panel, events, log)                                                                                     |
| Tests    | `src-tauri/tests/{dump,restore,export,import,copy}.rs`, `tools/*/tests.rs`, `dump_profiles/tests.rs`, `*Dialog.test.tsx`, `lib/*.test.ts`                                                                          |

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
- Import: a column type that does not fit stops the import by default with mongoimport's
  reason ("could not parse token `x` to type int32"); documents before it are already in the
  collection. Row numbers in mongoimport's messages count rows passed on (without the header).
  Date layouts cannot contain a literal `T`; use the ISO 8601 types for those. Decimal commas
  (`1,5`) are not converted. A text file that cannot be read halfway fails the job after
  mongoimport has imported the rows before it. JSON files cannot leave fields out.
- Copy: both connections must be reachable from this computer; data passes through it (no
  server-to-server copy). Replacing drops only the copied collections, not the whole target
  database. Views are copied with a database; a single view cannot be copied (its definition
  refers to collections by name). Users and roles are not copied. When both tools fail, the
  one that stopped first is named (the other only lost its pipe); mongorestore's connection
  errors come without `Failed:`, so its last line is used. The UUID check waits at most
  5 seconds for the collection lists. When they cannot be read in time, a copy with replace
  is refused (it could otherwise drop the source); any other copy goes ahead, and the
  same-name check in the form still applies.
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
- `cargo test --test import` (Docker + `pnpm sidecars`): JSON lines with Extended JSON, the
  same again (duplicates counted), drop, a JSON array merged into existing documents, a
  semicolon file with a byte order mark using the suggested types, a nested renamed field and
  a column left out, a type failure (stop) and skip-row, a collection with validation rules
  imported into with and without skipping them, a 20,000-row file without header with 4
  insert workers.
- `cargo test --test import_large -- --ignored` (opt-in, not in CI): generated JSON and CSV
  files of several GB, each imported with 1 and with several insert workers, then a cancel
  partway; see [testing](../development/testing.md#large-file-import).
- `cargo test --test copy` (Docker + `pnpm sidecars`): from a server without auth into one with
  SCRAM auth: a collection with a query under another name with its index, a database
  without one collection (with its view), the same again (duplicates counted), with replace
  and without indexes; copying onto itself refused (same connection, and another saved
  connection to the same server), a copy within one server under another name, and a target
  name the server refuses (mongorestore is blamed, not mongodump's broken pipe). The logs
  never contain the password.
- `cargo test tools::` arguments and scope rules, parsing (oplog lines, restore output, the
  archive prelude, dump folders), quoting;
  `cargo test dump_profiles::` the store; `cargo test jobs::` registry behavior.
- `pnpm test src/features/jobs src/features/tools src/features/command-palette`.
