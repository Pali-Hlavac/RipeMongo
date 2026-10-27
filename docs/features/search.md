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
  searched inside, says how many databases were not searched because of the limit (the match
  may be there) with the `database.collection` tip, and offers **Clear filter**.

### Go to collection

- **Ctrl/Cmd+P**, or "Go to collection…" in the command palette, opens a picker over every
  collection and view of the **connected** connections. Typing matches like the sidebar filter
  (fuzzy, `db.coll`); each result shows its database (and connection, when several are
  connected) with the matched letters highlighted. Enter opens (or focuses) its tab.
- **Recently opened first**: collections whose tab was activated in this session are listed
  under "Recently opened", newest first, except the one on screen (so Ctrl+P, Enter goes back
  to the previous collection; the current one is still listed with the others); the rest
  follow by score (collection-name matches above database-name matches), then by connection,
  database and collection name.
- The picker sits near the top of the window, so its box does not move while the list
  changes length.
- At most 100 results are listed; the footer says how many more matched, how many databases
  were not searched, or that lists are still loading.

### Find on this page

- **Ctrl/Cmd+F** in a collection tab (or the magnifier in the documents toolbar) opens a find
  bar under the toolbar. It **only searches the documents of the current page**, never the
  database; the bar says so ("Searches only the 20 documents on this page, not the
  collection. Use the filter to query the database.").
- Matching is a plain substring, ignoring case, of **what the current view shows**:
  - **List**: field names (not array positions) and leaf values as displayed (`7`,
    `"text"`, `ObjectId("…")`); objects and arrays holding hits open by themselves (until
    toggled by hand), hidden fields with hits are shown, a value with hits is shown whole and
    the one holding the current hit wraps instead of being cut off;
  - **JSON**: each document's text (field names included);
  - **Table**: the cells (nested values are shown as "{ 3 fields }", so they match only
    that); the row of the current hit is scrolled into the virtualized grid.
- Every hit is marked; the current one stands out. "3 of 12", **Enter** / **Shift+Enter** or
  the arrows for next / previous (wrapping around), **Esc** or × closes and removes the marks.
  A new page or reload starts again at its first hit; switching views recounts.

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
- **Go to collection** (`catalog/components/goto/`) mounts its list only while open and uses
  the same loader (`useCatalogLists`, shared with `useCatalogSearch`) with the query's
  candidate databases, flattens the loaded collections into entries and ranks them with
  `lib/goto.ts`. The app passes the connected profiles in (`useConnectedProfiles` from the
  connections feature), so catalog does not import connections. `store/recent.ts` subscribes
  to the tabs store and records every collection tab that becomes active (20, in memory).
  Ctrl+P is also the browser's print shortcut, which the app already blocks.
- **Find on this page** (`documents`): `lib/find.ts` computes the hits per view (`listHits`,
  `jsonHits`, `tableHits`) from the same text functions the views render, each with an id
  made of document key, path, part and occurrence number. `useDocumentFind` (open state,
  text, current index, Ctrl+F) feeds a `FindContext` around the view; `FindText` recomputes
  the occurrences of one piece of text and marks them, with `data-find-current` on the
  current one, which is scrolled into view (a few frames later for virtualized table rows,
  which `TableView` first scrolls to). The page's document array must keep its identity
  (`NO_DOCUMENTS` while nothing is loaded), because a new array means a new page.
- No backend changes: the existing `list_databases` and `list_collections` commands are used.

## Key files

| Path                                                                 | Responsibility                               |
| -------------------------------------------------------------------- | -------------------------------------------- |
| `src/shared/lib/fuzzy.ts`                                            | Fuzzy match with ranges and score            |
| `src/shared/components/Highlight.tsx`                                | Marks matched characters                     |
| `src/features/catalog/lib/filter.ts`                                 | `db.coll` parsing, database/collection match |
| `src/features/catalog/api/search.ts`                                 | Loads what the filter searches, with a limit |
| `src/features/catalog/store/filter-expanded.ts`                      | Rows toggled by hand while filtering         |
| `src/features/catalog/components/goto/`                              | Go to collection dialog and result list      |
| `src/features/catalog/lib/goto.ts`                                   | Entries, matching and ranking for the picker |
| `src/features/catalog/store/recent.ts`                               | Recently opened collections (this session)   |
| `src/features/connections/lib/filter.ts`                             | Connection match (name, folder, host, color) |
| `src/features/connections/components/sidebar/SidebarFilterBox.tsx`   | The box and its shortcut                     |
| `src/features/connections/components/sidebar/ConnectionTreeView.tsx` | Applies the filter to the groups             |
| `src/features/connections/hooks/useSidebarNavigation.ts`             | Arrow keys, Enter and Esc                    |
| `src/features/documents/lib/find.ts`                                 | Hits per view, ids, paths to open            |
| `src/features/documents/hooks/useDocumentFind.ts`                    | Find state, Ctrl+F, current hit, scrolling   |
| `src/features/documents/components/find/`                            | Find bar, context, marked text               |

## Edge cases and limitations

- The sidebar filter and Go to collection search names only, never documents or fields.
- Find on this page never searches beyond the loaded page. Long table cells are cut by the
  column width, so a hit far into a cell may be hidden until the column is widened (the
  counter still counts it, and the list view shows it).
- Databases or collections created by other clients appear after a refresh (lists are cached
  for 60 s while filtering, like the tree).
- A favorite appears twice (Favorites and its folder), as without the filter.
- Very large servers: at most 100 databases per connection are listed for a plain-text
  search; `database.collection` narrows which ones.
- Recently opened collections are remembered only while the app runs.

## How to test

- Frontend: `pnpm test` — `fuzzy.test.ts` (substring, word starts, chunks, backtracking),
  `catalog/lib/filter.test.ts` (parsing, plain text, `db.coll`, unloaded collections),
  `connections/lib/filter.test.ts` (name, folder, host, color, catalog matches, loading),
  `SidebarFilter.test.tsx` (hiding and highlighting, Enter opens the first collection, arrow
  keys and Esc, empty state, shortcut, the 100-database limit and its hint),
  `goto.test.ts` (order without a query, recent first, scores, `db.coll`),
  `GoToCollectionDialog.test.tsx` (Ctrl+P, results from two connections, Enter opens the tab,
  recently opened group, nothing connected, no matches), `documents/lib/find.test.ts`
  (occurrences, list, JSON and table hits, array positions, paths to open),
  `DocumentFind.test.tsx` (Ctrl+F, page-only note, nested fields open, Enter / Shift+Enter
  wrap, no matches, Esc removes marks, JSON view from the toolbar, table cells).
- Manual: connect to a server with a few databases, type part of a collection name, then
  `db.` plus part of a collection name; use ↓, Enter and Esc. Press Ctrl+P, type part of a
  name, press Enter; open another collection and check that Ctrl+P lists it first. In a
  collection tab press Ctrl+F, type a value from a nested field and step through the hits in
  all three views.
