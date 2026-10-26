# Viewing documents

Click a collection in the sidebar to open it. Its documents appear below the collection's
statistics, a page at a time.

## Choose a view

Use **List**, **JSON** or **Table** above the documents. Each tab remembers its choice.

- **List** shows each document as a card. Click a field that holds an object or a list (for
  example `address: { 2 fields }`) to open it. Values are colored by type; hover a value to see
  its exact type, such as _Int64_ or _Date_.
- **JSON** shows each document as text, in the same format you can type into queries.
- **Table** shows one row per document and one column per field. Drag the edge of a column
  header to make it wider or narrower. Fields that hold objects or lists show how many items
  they contain.

## Move between pages

- The arrows at the top right go to the previous and next page.
- Choose how many documents to show per page (10 to 1000).
- The text next to the arrows tells you which documents you are looking at, for example
  "21–40 of about 1,500". "About" means the total is a quick estimate.

RipeMongo never loads a whole collection at once, so even very large collections open quickly.

## Copy a document

Hover a document in the List or JSON view and click the copy button in its top-right corner.
The document is copied as text that you can paste into a query or another tool.

## Reload

Click the circular arrow next to the view buttons to load the current page again, for example
after another program changed the data.

## Find text on the page

Press **Ctrl+F** (**⌘F** on macOS) or click the magnifier next to the reload button, then type.
RipeMongo highlights the text wherever it appears in the documents you are looking at, in field
names and values, and opens nested fields that contain it. "2 of 7" tells you where you are;
press **Enter** for the next match and **Shift+Enter** for the previous one. **Esc** closes the
find bar.

This only searches the documents on the current page, not the whole collection. To find
documents in the database, use the filter in the query bar.

## Export and import

Click **Export** above the documents to save the documents you are looking at (with the filter
and sort you applied) as a JSON or CSV file. Click **Import** to add documents from a file. See
[Exporting and importing](import-export.md).

## Find specific documents

Use the query bar above the documents to filter, sort and choose fields; see
[Finding documents](querying.md).

## Change documents

To add, edit, copy or delete documents, see [Editing documents](editing-documents.md).
