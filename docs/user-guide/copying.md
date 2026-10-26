# Copying data

RipeMongo can copy a database or a collection to another server, for example from production
to your own computer, or make a copy within the same server under another name. Documents,
indexes and collection settings come along. The data goes straight from one server to the
other through RipeMongo; no file is saved. It uses MongoDB's own `mongodump` and
`mongorestore`, which come with RipeMongo.

To keep a copy in a file instead, make a dump (see [Backing up and restoring](backups.md)).

## Copy a database or collection

1. Connect to the server you copy from.
2. In the sidebar, open the **⋯** menu of a database → **Copy database…**, or of a collection
   → **Copy collection…**.
3. Under **Copy to connection**, choose where the copy goes. It can be any saved connection;
   RipeMongo connects to it when the copy starts. Choose the same connection to make a copy
   next to the original.
4. Check the names in the target. In another connection they stay the same; in the same
   connection RipeMongo suggests a name ending in `_copy`. You can type any other name.
5. Choose the options (see below) and click **Start copy**.

The copy runs in the background. The Background jobs window shows how many documents are
copied out of the total, and a message tells you when it is done and how many documents
were copied. Afterwards the sidebar of the target shows the new data.

## Options

- **Only documents matching** (collections): a filter, written like the filter above the
  documents, for example `{ status: "paid" }`. Leave it empty to copy every document.
- **Collections** (databases): untick collections you do not want to copy. You can also leave
  out every collection whose name starts with some text, such as `tmp_`. Views are copied too.
- **Copy indexes**: on by default. Turn it off to copy only the documents, for example when
  the indexes would take long to build on a test server.
- **Replace**: deletes the collection in the target first, with its documents and indexes,
  so the target ends up exactly like the source. For a database, only the collections that
  are copied are deleted; other collections in the target database stay. You confirm by
  typing the name. This cannot be undone.

Without **Replace**, the documents are added to what is already there. A document whose
`_id` already exists in the target is not copied, and the final message counts it.

## Good to know

- Both servers must be reachable from your computer, and the data passes through it, so a
  large copy takes as long as your connection needs to download and upload it.
- RipeMongo refuses to copy a collection onto itself, even when two saved connections lead to
  the same server. If a server does not answer within a few seconds, it cannot check this,
  so a copy with **Replace** is refused; try again when both servers are reachable.
- Users and roles are not copied. A single view cannot be copied on its own; copy its
  database instead.
- You can cancel a copy in the Background jobs window. What was already copied stays in the
  target.
