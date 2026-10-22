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

## Coming next

Filtering, sorting and choosing fields with the query bar, and adding, editing and deleting
documents, are coming in the next updates.
