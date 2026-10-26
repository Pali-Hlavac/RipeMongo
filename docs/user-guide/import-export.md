# Exporting and importing

RipeMongo can save the documents of a collection as a JSON or CSV file, for example to open
them in a spreadsheet or hand them to another program. It uses MongoDB's own `mongoexport`,
which comes with RipeMongo.

To make a full backup that keeps indexes and every detail, use a dump instead (see
[Backing up and restoring](backups.md)).

## Export a collection

1. Connect to the server.
2. Start the export in one of two ways:
   - in the sidebar, open a collection's or view's **⋯** menu → **Export to JSON or CSV…**;
   - in an open collection tab, click **Export** above the documents. The filter, sort, skip
     and limit you applied there are filled in, so you export exactly what you are looking at.
3. Choose the **Format**:
   - **JSON** keeps every value as it is, with nested documents and types such as dates. You
     can import it again later.
   - **CSV** is a table for spreadsheets: one row per document and one column per field.
4. Click **Browse…** and choose where to save the file.
5. Choose the fields (see below), then click **Start export**.

The export runs in the background. The Background jobs window shows how many documents are
written out of the total, and a message tells you when the file is ready.

## Choose the fields

RipeMongo reads a sample of the collection's documents and lists the fields it finds. Untick
the ones you do not need; **All** and **None** tick or untick everything. If a field is
missing from the list (because few documents have it), type its name under **Other fields**,
for example `notes, address.zip`.

- **JSON:** with every field ticked, whole documents are exported, including fields the sample
  did not see.
- **CSV:** each ticked field becomes a column. Fields inside nested documents are listed with
  dots, such as `address.city`. Lists and nested documents that you tick as a whole are
  written as JSON text in their cell.

## More options

- **JSON:**
  - **One JSON array instead of one document per line**: some programs expect a single array.
  - **Indented, easier to read**: makes the file bigger.
  - **Keep every type exactly**: writes numbers, dates and other values in a form that keeps
    their exact type (canonical Extended JSON). Use it when the file goes back into MongoDB.
- **CSV:** **Field names as the first line**: turn it off if the program you use expects only
  data.
- **Query filter, Sort, Skip, Limit:** export only some documents, in a given order, the same
  way you write them above the documents list. Leave them empty to export everything.

If the collection tab has a projection, it is not used for the export; choose the fields in the
dialog instead.

## Import a file

Importing JSON and CSV files is coming next.
