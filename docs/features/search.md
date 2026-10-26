# Search and navigation

## What it does

### Sidebar filter

- A filter box above the connection tree (focus it from anywhere with **Ctrl/Cmd+Shift+F**)
  narrows the sidebar to matching **connections, databases, collections and views**.
- **Fuzzy matching** (`shared/lib/fuzzy.ts`): the text matches anywhere in a name, ignoring
  case, or in chunks that each start a word (`oi` finds `orderItems`, `uspro` finds
  `user_profiles`). Matched characters are highlighted.
- **Connections** match by name, folder, any host (substring) or color label (`red`), always
  with the whole text, so host names with dots work.
- **`db.coll`** narrows the catalog: collections matching the part after the first dot in
  databases matching the part before it. Either part may be empty (`shop.` lists every
  collection of databases like `shop`, `.ord` finds `ord…` in every database).
- **Parents of matches open** automatically and **non-matching branches are hidden**. A row
  that matched by itself keeps its children: a matching connection shows its whole tree, a
  matching database shows all its collections when opened. Rows can still be opened and
  closed by hand while filtering; that choice lasts until the filter text changes and never
  touches the normal expanded state.
- **Keyboard**: ↓ from the box moves to the first row, ↑/↓ move between rows (↑ from the
  first row returns to the box), **Enter** in the box opens the first matching collection (or
  the first match), Enter on a row does what a click does, **Esc** clears the filter (from the
  box or a row).
- Nothing matches: an empty state says so, mentions that only connected connections are
  searched inside, and offers **Clear filter**.

## How it works

```
ConnectionSidebar ── SidebarFilterBox (store/filter.ts: input)
  └ ConnectionTreeView
      parseSidebarFilter(input)                     catalog/lib/filter.ts
      useCatalogSearch(connected ids, filter)       catalog/api/search.ts
        useQueries: list_databases per connected connection
        useQueries: list_collections per candidate database (first 100 fetched)
        matchDatabases → CatalogSearch { databases, notSearched, searching }
      matchConnections(profiles, text, searches)    connections/lib/filter.ts
  → ConnectionGroup (only matches) → ConnectionItem (highlight, open)
  → DatabaseTree filter → DatabaseNode → CollectionList → CollectionNode
```

- **What is searched**: names already known to the app. Saved connections always; for
  connected connections the database list and the collections of up to
  `SEARCH_DATABASE_LIMIT` (100) databases per connection, fetched with the same query keys as
  the tree (so they are shared and cached for 60 s). Collections of further databases are
  searched only if already loaded (a database was opened); the tree then says "N more
  databases were not searched" and suggests `database.collection`, which fetches only
  databases matching the database part. Databases of disconnected connections are never
  searched (no connecting behind the user's back).
- **While lists load**, a connected connection that only its catalog could match stays visible
  with "Searching…", so matches can appear without the row jumping in later.
- **Expanded state while filtering** lives in `catalog/store/filter-expanded.ts`: overrides per
  row key (`group\0…`, `connection\0id`, `id\0db`), valid for one filter text.
- **Keyboard navigation** (`connections/hooks/useSidebarNavigation.ts`) works on the DOM: the
  main button of each row carries `data-sidebar-row`, rows the filter matched carry
  `data-sidebar-match="connection" | "database" | "collection"`. Keys pressed inside row menus
  are ignored.
- No backend changes: the existing `list_databases` and `list_collections` commands are used.

## Key files

| Path                                                                 | Responsibility                               |
| -------------------------------------------------------------------- | -------------------------------------------- |
| `src/shared/lib/fuzzy.ts`                                            | Fuzzy match with ranges and score            |
| `src/shared/components/Highlight.tsx`                                | Marks matched characters                     |
| `src/features/catalog/lib/filter.ts`                                 | `db.coll` parsing, database/collection match |
| `src/features/catalog/api/search.ts`                                 | Loads what the filter searches, with a limit |
| `src/features/catalog/store/filter-expanded.ts`                      | Rows toggled by hand while filtering         |
| `src/features/connections/lib/filter.ts`                             | Connection match (name, folder, host, color) |
| `src/features/connections/components/sidebar/SidebarFilterBox.tsx`   | The box and its shortcut                     |
| `src/features/connections/components/sidebar/ConnectionTreeView.tsx` | Applies the filter to the groups             |
| `src/features/connections/hooks/useSidebarNavigation.ts`             | Arrow keys, Enter and Esc                    |

## Edge cases and limitations

- Only names are searched, never documents or field names.
- Databases or collections created by other clients appear after a refresh (lists are cached
  for 60 s while filtering, like the tree).
- A favorite appears twice (Favorites and its folder), as without the filter.
- Very large servers: at most 100 databases per connection are listed for a plain-text
  search; `database.collection` narrows which ones.

## How to test

- Frontend: `pnpm test` — `fuzzy.test.ts` (substring, word starts, chunks, backtracking),
  `catalog/lib/filter.test.ts` (parsing, plain text, `db.coll`, unloaded collections),
  `connections/lib/filter.test.ts` (name, folder, host, color, catalog matches, loading),
  `SidebarFilter.test.tsx` (hiding and highlighting, Enter opens the first collection, arrow
  keys and Esc, empty state, shortcut, the 100-database limit and its hint).
- Manual: connect to a server with a few databases, type part of a collection name, then
  `db.` plus part of a collection name; use ↓, Enter and Esc.
