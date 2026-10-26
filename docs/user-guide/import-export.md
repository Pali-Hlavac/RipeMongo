# Exporting and importing

RipeMongo can save the documents of a collection as a JSON or CSV file, for example to open
them in a spreadsheet or hand them to another program, and add documents from such files. It
uses MongoDB's own `mongoexport` and `mongoimport`, which come with RipeMongo.

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

1. Connect to the server.
2. Start the import in one of three ways:
   - in the sidebar, open a collection's **⋯** menu → **Import from JSON or CSV…**;
   - in an open collection tab, click **Import** above the documents;
   - to create a new collection, open a database's **⋯** menu → **Import into a new
     collection…**. The name is suggested from the file name; you can change it.
3. Click **Browse…** and choose the file. RipeMongo reads its beginning and shows what it found:
   - **JSON, one document per line** or **JSON array**: the documents are imported as they
     are, with their types (for example files exported from RipeMongo or MongoDB).
   - **Text with columns (CSV)**: a table, such as a file saved from a spreadsheet. See below.
4. Choose what happens to **existing documents** (see below), then click **Start import**.

The import runs in the background. The Background jobs window shows how much of the file is
done, and a message tells you how many documents were imported and how many could not be,
for example because they already exist or break the collection's validation rules.
Afterwards the sidebar and the open collection show the new documents.

## Tables (CSV and similar files)

- **Values separated by**: RipeMongo recognizes commas, semicolons (common in files from
  European spreadsheets), tabs and vertical bars. If the columns look wrong, pick another one.
- **First line has column names**: untick it if the file starts directly with data. Columns are
  then called field1, field2, …
- **Columns**: for each column you see a few of its values and can:
  - untick it to leave it out;
  - change the **field name**. A dot creates a nested document: `address.city` puts the value
    into `{ address: { city: … } }`;
  - choose the **type**. RipeMongo suggests one from the values:
    - **Automatic**: numbers become numbers, everything else text.
    - **Text**: always text. Use it for codes such as zip codes or phone numbers, so `01234`
      keeps its leading zero.
    - **Whole number**, **Decimal number**, **Exact decimal** (for money), **True / false**
      (`true`/`false` or `1`/`0`).
    - **Date, ISO 8601** with or without a time zone, such as `2024-03-05T10:20:30Z`. Without a
      zone, the time is taken as UTC.
    - **Date in another format**: type how the dates look, using `yyyy` (year), `MM` (month),
      `dd` (day), `HH` (hour), `mm` (minutes) and `ss` (seconds), for example `dd.MM.yyyy` or
      `yyyy-MM-dd HH:mm`.
    - **Binary** written as base64 or hex.
- **Leave out fields whose value is empty**: empty cells add no field instead of an empty text.
- **When a value does not fit its type**: stop the import (the default; the message names the
  value), leave that field or row out, or import the value as Automatic.

## Existing documents

- **Insert only** (default): new documents are added. A document whose `_id` already exists
  is not imported and is counted as failed.
- **Replace matching documents** or **Update fields of matching documents**: documents that
  match one in the file are replaced or updated, the others are added. They match on `_id`,
  or on the fields you type under **Match documents on** (for example `email`).
- **Stop at the first document that cannot be imported**: otherwise the import continues and
  counts the failures.
- **Drop the collection first**: deletes every document and index of the collection before
  importing. You confirm by typing the collection's name. This cannot be undone.

## Faster imports

For large files, two options can make the import faster:

- **Insert workers**: how many batches of documents are written at the same time, from 1 to 16. Leave it empty for one. On a server with several processor cores, 4 to 8 workers often
  import about twice as fast. More workers put more load on the server, and the documents are
  no longer added in the order of the file. With **Replace** or **Update fields**, a file
  that contains the same document twice may then keep either version.
- **Skip validation rules**: imports documents even when they break the collection's
  validation rules (the rules that say, for example, which fields a document must have).
  Documents the rules would reject then end up in the collection, and apps that rely on the
  rules may not handle them. Use it only for data you trust. Your database user needs the
  permission to bypass validation.
