# Databases and collections

Once you are connected, the sidebar shows what is on the server.

## Browse

- Click the small arrow next to a connected connection to show its **databases**. The arrow
  opens by itself right after you connect.
- Click a database to show its **collections**. The number on the right of a collection is how
  many documents it holds (for example "12K" means about twelve thousand). Hover it to see the
  exact number.
- Icons show what each item is:
  - a table for a normal collection,
  - an eye for a **view** (a saved, read-only query on another collection),
  - a clock for a **time-series** collection (measurements over time).
- Click a collection to open it in a tab. The top of the tab shows how many documents it has and
  how much space it uses. Browsing and editing documents is coming in the next update.

Only databases you are allowed to see are listed. If the list looks out of date, choose
**Refresh databases** from the connection's **⋯** menu, or **Refresh** from a database's menu.

## Create a database

1. Open the **⋯** menu of a connected connection and choose **Create database…**.
2. Enter the database name and the name of its first collection. MongoDB only keeps a database
   that contains at least one collection.
3. Click **Create database**.

Database names cannot contain spaces or any of `/ \ . " $ * < > : | ?`.

## Create a collection or view

Open the **⋯** menu of a database and choose **Create collection…**, then pick a type:

| Type            | Use it for                                                                         |
| --------------- | ---------------------------------------------------------------------------------- |
| **Standard**    | Most data.                                                                         |
| **Capped**      | Logs and similar data: when the size limit is reached, the oldest documents go.    |
| **Time series** | Measurements over time, such as sensor readings. Needs the field holding the time. |
| **View**        | A read-only, saved query on another collection.                                    |

For a view, choose the source collection and write the pipeline that filters or reshapes its
documents, for example `[{ $match: { status: "open" } }]`. You can also start from a collection:
its **⋯** menu has **Create view…** with that collection already chosen.

## Rename a collection

Choose **Rename…** from the collection's **⋯** menu. Documents and indexes are kept, and an open
tab follows the new name. Applications that use the old name will no longer find it. Views and
time-series collections cannot be renamed.

## Drop (delete) a database, collection or view

Choose **Drop…** from the item's **⋯** menu. Because this permanently deletes data, RipeMongo
asks you to **type the exact name** before the button becomes active. Dropping a view deletes
only the view; the documents of its source collection stay.

## When something goes wrong

If the server refuses a change, the dialog stays open and explains why. For example, your user
may not have permission, or a collection with that name may already exist.
