# Editing documents

You can add, change, copy and delete documents in any collection you are allowed to write to.
Views and read-only collections show their documents without these buttons.

## Add documents

1. Click **Insert** above the documents.
2. Type a document, for example `{ name: "Pen", qty: 3 }`. To add several at once, type a list:
   `[{ name: "Pen" }, { name: "Ink" }]`.
3. Click **Insert** or press **Ctrl+Enter** (**⌘Enter** on macOS).

If you leave out `_id`, the database creates one for you. You can add up to 10,000 documents
at once; for more, use Import (coming in a later update).

## Edit a document

Hover a document in the List or JSON view and click the pencil button. In the Table view,
double-click a row. The document opens in an editor where you can change, add or remove any
field. Click **Save** or press **Ctrl+Enter**.

You cannot change a document's `_id`. If you remove it from the text, the document keeps its
current `_id`.

The editor understands the same format as the query bar, so you can write values like
`ISODate("2024-05-01")`, `NumberLong(5)` or `ObjectId("…")`. If something cannot be read, the
problem is underlined in the editor and explained below it.

## Change one value quickly

In the List view, double-click a value (or select it and press **Enter**). Type the new value
and press **Enter** to save, or **Esc** to cancel. Write text in quotes (`"Bratislava"`); numbers,
`true`/`false` and values like `ISODate("…")` without quotes.

## Copy a document into a new one

Click the clone button (two overlapping squares with a plus) on a document. The editor opens
with the same fields but without the `_id`; change what you need and click **Insert**.

## Delete a document

Click the trash button on a document and confirm. Deleting cannot be undone.

## If someone else changed the document

RipeMongo never overwrites changes it did not show you. If the document was changed (by
another person or program) after it was loaded, saving stops with the message that it
"changed since it was loaded". Close the editor, click the reload button, and make your change
again.

## When editing is turned off

- While **Project** is used in the query bar, the edit and clone buttons are turned off, because
  the hidden fields would be lost. Clear the projection to edit whole documents. Changing one
  value and deleting still work.
- Documents without an `_id` (for example when the projection hides it) cannot be changed.

## Change or delete many documents at once

Use the **Bulk** button above the documents. Both actions start with the filter you are using
in the query bar; you can change it in the dialog. An empty filter means every document.

**Update documents**

1. Choose **Bulk → Update documents…**.
2. Type what to change, for example `{ $set: { status: "archived" } }` to set a field,
   `{ $inc: { qty: 1 } }` to add to a number, or `{ $unset: { oldField: "" } }` to remove a field.
3. Click **Preview** (or press **Ctrl+Enter**). You see how many documents match and the first
   few of them before and after the change.
4. Click **Update … documents**, type the collection name to confirm, and click
   **Update documents**.

If you change the filter or the update after previewing, preview again; the update button
stays off until the preview matches what you typed.

On a single server without a replica set, RipeMongo cannot show the result in advance; the
preview then shows the matching documents as they are now.

**Delete documents**

1. Choose **Bulk → Delete documents…**. The matching documents are counted right away.
2. Check the count and the examples, then click **Delete … documents**.
3. Type the collection name and click **Delete documents**.

Bulk changes cannot be undone. Consider exporting the collection first (coming with dump and
export in a later update).
