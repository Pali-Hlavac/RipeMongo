# Backing up with dump

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
  whose name begins with what you type, for example `tmp_, cache_`.
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

## Follow the progress

The **Background jobs** window opens and shows how many documents have been saved and which
collection is being written. You can close it and keep working; the dump continues. The
**Jobs** button at the bottom right shows how many jobs are running and opens the window again.

When the dump finishes, a message tells you how many collections and documents were saved and
where. If something goes wrong, the message says why, for example a folder that does not
exist or a missing permission on the server.

- **Cancel** stops a running dump. Files written so far stay where they are.
- **Details and log** shows everything `mongodump` reported, and the equivalent command if you
  want to run the same dump yourself later. Passwords are never included; RipeMongo hands them
  to the tool privately. Both have a **Copy** button, handy when asking for help.
- **Remove** clears a finished job from the list.

The list is cleared when you quit RipeMongo. Quitting while a dump runs stops it.

## Good to know

- You need to be connected, and the database user needs permission to read what you dump.
- Disconnecting while a dump runs does not interrupt it.
- Restoring a dump, importing and exporting JSON or CSV files and copying data between
  connections are coming soon.
