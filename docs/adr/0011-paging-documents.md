# 0011. Page documents with skip/limit plus one, never load a whole collection

- Status: Accepted
- Date: 2026-10-22

## Context

Collections can hold billions of documents. The UI must stay responsive, memory must stay
bounded, and the IPC payload of one request must stay small. Users expect Compass-like paging
("1–20 of 1,500", previous/next, page size) and a choice of views over the same page.

Options considered:

1. **Server-side cursor kept open between pages** (getMore on "next"). Efficient for forward
   scans, but cursors time out after 10 minutes idle, cannot go backwards, and keeping one per
   tab complicates reconnects and multiple windows.
2. **Range paging on `_id`** (`_id > lastSeen`). Fast at any depth but only works when sorted
   by `_id`; arbitrary user sorts break it.
3. **`skip` + `limit`** per page. Simple, stateless, works with any filter and sort; deep
   skips get slower on very large collections.

## Decision

- Each page is one stateless `find` with `skip` and `limit + 1`. The extra document only tells
  whether a next page exists (`hasMore`), so paging never needs a count.
- Page sizes: 10, 20 (default), 50, 100, 250, 500, 1000. The backend rejects 0 and anything
  above `MAX_PAGE_SIZE` (1000).
- Every `find` carries `maxTimeMS` (60 s by default) so a slow query fails with `TIMEOUT` instead
  of hanging the tab.
- The total ("of 1,500") is a separate, lazily loaded `count_documents`: the metadata estimate
  for an empty filter (labelled "about"), otherwise an exact `countDocuments` limited to 10 s.
  Paging works even if the count fails or times out.
- Documents cross IPC as canonical Extended JSON strings (see ADR 0012); the frontend keeps the
  previous page on screen while the next one loads.
- Paging state (skip, page size, view) lives per tab in a Zustand store; the page data lives in
  TanStack Query, keyed by connection, namespace and the full request.

## Consequences

- Deep pages on huge collections (skip in the millions) get slower; range paging on `_id` can
  be added later as an optimization for `_id`-sorted queries without changing the IPC shape.
- Results can shift between pages if other clients write meanwhile (same as Compass).
- Memory is bounded by the page size, regardless of collection size.
