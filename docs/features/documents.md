# Documents

## What it does

- A collection tab shows its documents page by page under the collection header.
- Three views of the same page, switchable per tab:
  - **List**: one card per document; nested objects and arrays expand on click; values are
    colored by type and show mongosh syntax (`ObjectId("…")`, `ISODate("…")`,
    `NumberLong("…")`); the tooltip names the BSON type. Wide documents show 25 fields, then
    "Show N more fields".
  - **JSON**: each document as pretty mongosh-style text, the same syntax the query bar
    accepts.
  - **Table**: one column per top-level field (in order of first appearance, `_id` first,
    at most 200), resizable columns, row numbers, virtualized rows; nested values show as
    "{ 3 fields }" / "[ 5 items ]".
- **Paging**: 10–1000 documents per page (default 20), previous/next, "1–20 of about 1,500".
- **Copy** a document (hover a card) as shell syntax.
- **Reload** re-runs the current page and count.
- **Query bar**: filter (always visible) plus Options for projection, sort, collation, skip,
  limit and max time; Enter or Find applies, Reset clears. Shell syntax everywhere (ADR 0012).
  A rejected query shows the backend message under the bar and marks the named part invalid.
- **Autocomplete** (ARIA combobox, no editor dependency): field paths from the loaded page
  (nested, documents in arrays), `$` operators per part (filter vs. projection; none for sort),
  collation keys, and shell constructors with the caret placed inside the quotes.
- **History and favorites** per connection + collection: successful runs are recorded (most
  recent first, duplicates moved up, 30 kept); named favorites (replaced by name, up to 100),
  managed in a dialog. Stored locally in `query-history.json`.

Not yet: inserting, editing and deleting documents (next M3 slices).

## How it works

```
CollectionTabView (app) → CollectionDocuments (documents)
  → api/queries.ts useDocumentPage / useDocumentCount (TanStack Query)
  → find_documents / count_documents
  → documents::service (FindOptions: skip, limit + 1, maxTimeMS; ejson parses query parts)
  ← FindPage { documents: canonical EJSON strings, hasMore }
  → lib/ordered-json.ts → lib/bson.ts (typed BsonValue tree) → views (lib/format.ts)
```

- Paging is stateless `skip`/`limit + 1` (ADR 0011); the count is separate and optional. The
  query's own skip/limit are applied on top of paging in the frontend (`lib/query.ts`
  `pageWindow`, `pageHasMore`, `visibleCount`).
- The query bar edits a draft; Find writes it to the tab's `query` in `store/view.ts`, which
  keys the page and count queries. Successful, non-placeholder results record the query
  (`hooks/useRecordSuccessfulQuery.ts` → `record_query`).
- Documents travel as canonical Extended JSON and are parsed in order (ADR 0012).
- Per-tab view settings (`view`, `pageSize`, `skip`) live in `store/view.ts`; query data in
  TanStack Query under `["documents", connectionId, db, collection, …]`, removed on
  disconnect or when the connection is deleted. The previous page stays visible while the
  next one loads.

## Key files

| Path                                         | Responsibility                                   |
| -------------------------------------------- | ------------------------------------------------ |
| `src-tauri/src/documents/`                   | `find_documents`, `count_documents`, page limits |
| `src-tauri/src/ejson/`                       | Query parsing, canonical serialization           |
| `src/features/documents/lib/ordered-json.ts` | Order-preserving JSON reader                     |
| `src/features/documents/lib/bson.ts`         | Canonical EJSON → typed `BsonValue`              |
| `src/features/documents/lib/format.ts`       | Shell syntax (`toShell`), previews, type labels  |
| `src/features/documents/components/`         | Collection view, pager, list/JSON/table views    |
| `src/features/documents/store/view.ts`       | Per-tab view mode, paging and applied query      |
| `src/features/documents/components/query/`   | Query bar, autocomplete input, history menu      |
| `src/features/documents/lib/completion.ts`   | Autocomplete context and suggestions             |
| `src-tauri/src/query_history/`               | Recent and favorite queries (JSON file)          |

## Edge cases and limitations

- Deep pages on very large collections are slower (skip); see ADR 0011.
- Counts use the metadata estimate when there is no filter ("about"); an exact count with a
  filter gives up after 10 s, and paging still works without it.
- Dates outside the JavaScript range are shown as milliseconds and copied as
  `{ $date: { $numberLong: "…" } }`.
- Suggestions only know fields of the documents on screen.
- History keeps the text parts (filter, projection, sort, collation), not skip/limit/time.
- History of a deleted connection stays in `query-history.json` (never shown again).
- The table shows the fields of the loaded page only; a field that appears only on other pages
  has no column until you get there.

## How to test

- Rust: `pnpm test:rust` — `documents::service` unit tests, the cross-language round-trip test
  in `ejson/tests.rs`, and `tests/documents.rs` (Docker: paging, filters in shell syntax,
  projection, counts, error naming).
- Frontend: `pnpm test` — `bson.test.ts` (ordered parsing, types, shell output, previews),
  `CollectionDocuments.test.tsx` (list expand, paging, JSON and table views),
  `QueryBar.test.tsx` (run, record, suggestions, inline errors, history),
  `completion.test.ts`, `query.test.ts`; Rust `query_history/tests.rs`.
- Manual: open a collection with nested documents; switch views; change the page size and go
  to the next page.
