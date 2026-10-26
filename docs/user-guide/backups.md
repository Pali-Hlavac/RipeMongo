# Backing up and restoring

RipeMongo can save a copy (a "dump") of a whole server, a database or a single collection.
It uses MongoDB's own `mongodump`, which comes with RipeMongo, so you do not need to install
anything.

## Make a dump

1. Connect to the server.
2. In the sidebar, open the **⋯** menu of what you want to back up:
   - the connection → **Dump all databases…**
   - a database → **Dump database…**
   - a collection → **Dump collection…**
3. Choose how to save it:
   - **Folder**: a folder with one sub-folder per database and a file per collection. Good for
     looking at or restoring single collections later.
   - **Single archive file**: everything in one file. Easy to copy, send or store.
4. Click **Browse…** to pick the folder or file.
5. Turn on **Compress with gzip** to make the dump smaller (it takes a little longer).
6. Click **Start dump**.

If you dump into a folder that already has a dump, files of the same collections are replaced.

## Choose what goes in

The dialog shows the options that make sense for what you are dumping:

- **One collection: Query filter.** Dump only the documents that match, for example
  `{ status: "active" }` or `{ createdAt: { $gte: ISODate("2026-01-01") } }`. You write it the
  same way as the filter above the documents list. Leave it empty to dump everything.
- **A database: Collections.** Untick the collections you do not need; **All** and **None**
  tick or untick everything. **Also leave out names starting with** skips every collection
  whose name begins with what you type, for example `tmp_, cache_`; the list marks those as
  "left out by prefix".
- **All databases: Point-in-time snapshot (oplog).** On a replica set, the dump also records
  the changes made while it runs, so restoring it gives a consistent picture of one moment.
  It does not work on a single standalone server.
- **Collections at a time.** How many collections are saved in parallel (1 to 16; empty means
  4). Lower it if the server is busy, raise it to finish sooner.

## Save a dump to run again

To repeat the same backup later with one click:

1. In the dump dialog, tick **Save for one-click re-runs** and give it a name, for example
   "Nightly shop backup".
2. Click **Save and start** to save it and run it now, or **Save** to only save it.

Your saved dumps are in **Saved dumps**: open the command palette (Ctrl+K, or Cmd+K on a Mac)
and type "Saved dumps", or use **Saved dumps…** in a connected connection's **⋯** menu. For
each one you see what it dumps, where to, its options and when it last ran.

- **Run** starts it right away. If you are not connected yet, RipeMongo connects first.
- **Edit** (pencil) opens the dump dialog with the saved settings. **Save** keeps your changes.
- **Delete** (bin) removes it from the list. Dumps it already made stay where they are.

A saved dump writes to the same place every time, so it replaces the previous copy there.
Collections you unticked stay left out; collections created later are included. When you
delete a connection, its saved dumps are deleted too.

## Restore a dump

1. Connect to the server you want to restore into.
2. Open the connection's **⋯** menu → **Restore…**.
3. Choose **Folder** or **Single archive file** and click **Browse…** to pick the dump.
   RipeMongo reads it and lists its databases and collections. Compressed dumps work without
   any extra setting.
4. Untick what you do not want to restore.
5. To restore a database as a copy, type a new name next to it, for example `shop_restored`.
6. Choose the options:
   - **Drop each collection before restoring it** replaces collections that already exist.
     Without it, existing documents stay, and documents from the dump with the same `_id` are
     skipped (the summary says how many). Because dropping cannot be undone, RipeMongo asks you
     to type the connection's name first.
   - **Replay the oplog** appears for dumps made with the point-in-time option. It needs
     everything restored under its own name.
   - **Dry run** only checks the dump and tells you what would be restored. Nothing is
     written.
   - **Collections at a time** works as for dumps.
7. Click **Restore** (or **Start dry run**).

While it runs, the Background jobs window shows how far it is. For a dump folder you see the
amount of data read out of the total; for an archive file, the collection being restored and
how much of it was read. When it finishes, a message tells you how many documents were
restored and how many could not be, and the sidebar shows the restored databases.

## Follow the progress

The **Background jobs** window opens and shows how many documents have been saved or restored
and which collection is being worked on. You can close it and keep working; the job continues. The
**Jobs** button at the bottom right shows how many jobs are running and opens the window again.

When a dump finishes, a message tells you how many collections and documents were saved and
where. If something goes wrong, the message says why, for example a folder that does not
exist or a missing permission on the server.

- **Cancel** stops a running dump or restore. Files written so far stay where they are, and
  so do documents already restored.
- **Details and log** shows everything the tool reported, and the equivalent command if you
  want to run it yourself later. Passwords are never included; RipeMongo hands them
  to the tool privately. Both have a **Copy** button, handy when asking for help.
- **Remove** clears a finished job from the list.

The list is cleared when you quit RipeMongo. Quitting while a job runs stops it.

## Good to know

- You need to be connected, and the database user needs permission to read what you dump.
- Disconnecting while a dump or restore runs does not interrupt it.
- To move data to another server without keeping a file, copy it instead (see
  [Copying data](copying.md)). For JSON or CSV files, see
  [Exporting and importing](import-export.md).
