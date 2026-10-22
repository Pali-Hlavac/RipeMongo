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
