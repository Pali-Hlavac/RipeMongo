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

## Coming next

Updating or deleting all documents that match a filter is coming in the next update.
