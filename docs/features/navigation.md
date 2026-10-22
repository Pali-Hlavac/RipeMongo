# Navigation: databases and collections

## What it does

- A connected connection in the sidebar expands (chevron) into its **databases**, each with its
  size on disk, and each database into its **collections and views**, with a compact document
  count. Icons tell collections, views and time-series collections apart.
- The tree expands automatically after a successful connect; expanded databases are remembered
  while the app runs, even when the connection row is collapsed.
- Clicking a collection opens (or focuses) its **collection tab**. The tab header shows the
  namespace, kind (capped, read-only, view source) and statistics: documents, data size,
  average document size, storage size and index size, followed by the documents (see
  [documents.md](documents.md)).
- "⋯" menus:
  - connection (while connected): **Create database…**, **Refresh databases**;
  - database: **Create collection…**, **Refresh**, **Drop database…**;
  - collection: **Create view…** (with this collection as source), **Rename…** (regular
    collections only), **Drop collection… / Drop view…**.
- **Create collection** dialog: standard, capped (maximum size in MB, optional document limit),
  time series (time field, optional meta field, granularity, expiry) or view (source
  collection and a pipeline in JSON or shell syntax).
- **Drops require typing the exact name** (`ConfirmByTypingDialog`). Dropping closes the tabs of
  the dropped namespaces; renaming re-points an open tab to the new name.

## How it works

```
ConnectionItem (connections) ── chevron ──► DatabaseTree (catalog)
  → DatabaseNode → CollectionNode
  → api/queries.ts: useDatabases / useCollections / useCollectionStats
  → list_databases / list_collections / collection_stats
  → databases::service / collections::service (mongodb driver)

Dialogs (store/dialogs.ts, one open at a time) → api/mutations.ts
  → create_database / create_collection / create_view / rename_collection / drop_*
  → invalidate ["catalog", connectionId, …] + sync workspace tabs (lib/tabs.ts)
```

- **Query keys**: `["catalog", connectionId, "databases"]`,
  `["catalog", connectionId, "database", db, "collections" | "stats", …]`. Disconnecting removes
  everything under `["catalog", connectionId]`.
- **Only connected connections render the tree**, so catalog queries never run against a closed
  connection. A collection tab of a disconnected connection shows the backend's
  `NOT_CONNECTED` error with its hint.
- **Counts are lazy**: each collection row fetches `$collStats` itself (30 s stale time). Views
  are skipped (no storage) and so are time-series collections; databases with more than 100
  collections skip counts to avoid a request storm.
- `list_databases` uses `authorizedDatabases`, so users without the `listDatabases` privilege
  still see databases they can access. `system.*` collections are hidden.
- **Names** are checked while typing (`lib/names.ts`): database names cannot contain
  `/ \ . " $ * < > : |?` or spaces and are at most 63 characters; collection names cannot
  contain `$` or start with `system.`. The server has the final word.
- Dialog errors (already exists, not allowed, invalid name, …) are shown inside the dialog;
  catalog mutations are `silent` for the global toast.

## Key files

| Path                                                             | Responsibility                                    |
| ---------------------------------------------------------------- | ------------------------------------------------- |
| `src-tauri/src/databases/`                                       | List, create (with first collection), drop        |
| `src-tauri/src/collections/`                                     | List, stats, create (options), view, rename, drop |
| `src-tauri/src/mongo/`                                           | Client lookup, `MongoError`, server-code mapping  |
| `src/features/catalog/api/`                                      | Query keys, queries, mutations                    |
| `src/features/catalog/components/tree/`                          | Database tree, nodes, row menus                   |
| `src/features/catalog/components/dialogs/`                       | Create, rename and drop dialogs                   |
| `src/features/catalog/lib/`                                      | Name checks, create-collection draft, tab sync    |
| `src/features/connections/components/sidebar/ConnectionItem.tsx` | Chevron and tree placement                        |
| `src/app/layout/CollectionTabView.tsx`                           | Collection tab (header + placeholder)             |

## Edge cases and limitations

- Time-series collections cannot be renamed (a server limitation), so the menu hides Rename.
- MongoDB 7+ accepts re-creating an identical collection without an error.
- A database exists only while it has a collection; Create database asks for the first one.
- Counts come from storage statistics and can lag briefly after writes; use Refresh.
- Changes made by other clients appear after Refresh (no live catalog watching).

## How to test

- Integration (Docker): `cargo test --manifest-path src-tauri/Cargo.toml --test catalog`
  — create/list/stats/rename/drop for databases, collections, capped, time series and views.
- Frontend: `pnpm test` — `DatabaseTree.test.tsx` (tree, counts, tab opening, menus, errors),
  `CatalogDialogs.test.tsx` (create, validation, inline errors, rename tab sync, drop by typing),
  `names.test.ts`, `new-collection.test.ts`, sidebar expand test.
- Manual: connect to a local `mongo:8.0`, expand the connection, create a database, add a
  capped collection and a view, rename, then drop with typed confirmation.
