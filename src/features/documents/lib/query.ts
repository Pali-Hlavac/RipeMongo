/** Helpers for the query parts typed in the query bar. */
import type { AppliedQuery } from "../store/view";
import type { DocumentCount, QueryParts } from "../types";

/** One-line summary of a query for menus: `{ a: 1 } · sort { b: -1 }`. */
export function describeQuery({ filter, projection, sort, collation }: QueryParts): string {
  const parts = [filter.trim() || "{}"];
  if (projection.trim()) parts.push(`project ${projection.trim()}`);
  if (sort.trim()) parts.push(`sort ${sort.trim()}`);
  if (collation.trim()) parts.push(`collation ${collation.trim()}`);
  return parts.join(" · ");
}

/** Only the text parts (drops UI-only settings such as the time limit). */
export function queryParts({ filter, projection, sort, collation }: QueryParts): QueryParts {
  return { filter, projection, sort, collation };
}

/**
 * The server window of one page: the query's own skip/limit applied on top of paging.
 * `pageSkip` is the pager offset (0, 20, 40, …).
 */
export function pageWindow(query: AppliedQuery, pageSkip: number, pageSize: number) {
  const remaining = query.limit > 0 ? query.limit - pageSkip : pageSize;
  return { skip: query.skip + pageSkip, limit: Math.max(1, Math.min(pageSize, remaining)) };
}

/** Whether the pager may go further, given the server's answer and the query's limit. */
export function pageHasMore(
  query: AppliedQuery,
  pageSkip: number,
  shown: number,
  serverHasMore: boolean,
) {
  return serverHasMore && (query.limit === 0 || pageSkip + shown < query.limit);
}

/** The total the pager shows: the count minus the query's skip, capped by its limit. */
export function visibleCount(query: AppliedQuery, count: DocumentCount | undefined) {
  if (count?.count == null) return undefined;
  const afterSkip = Math.max(0, count.count - query.skip);
  return { ...count, count: query.limit > 0 ? Math.min(afterSkip, query.limit) : afterSkip };
}
