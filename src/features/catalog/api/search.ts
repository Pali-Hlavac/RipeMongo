/**
 * Loads what the sidebar filter and "Go to collection" search: the databases of every
 * connected connection and the collections of up to {@link SEARCH_DATABASE_LIMIT} candidate
 * databases each. Collections that are already loaded (for example because a database was
 * expanded) are always searched. The query keys are the tree's, so the lists are shared.
 */
import { useQueries } from "@tanstack/react-query";

import { commands, unwrap } from "@/shared/ipc/client";

import {
  databaseCandidate,
  matchDatabases,
  type CatalogSearch,
  type SidebarFilter,
} from "../lib/filter";
import type { CollectionInfo, DatabaseInfo } from "../types";
import { catalogKeys } from "./keys";

/** Databases per connection whose collections are loaded for a search. */
export const SEARCH_DATABASE_LIMIT = 100;

/** Lists loaded for a search are reused this long before they are fetched again. */
const SEARCH_STALE_MS = 60_000;

/** The lists of one connected connection that a search can use. */
export interface LoadedCatalog {
  connectionId: string;
  databases: DatabaseInfo[];
  /** Collections of the candidate databases, by database name; unset until loaded. */
  collections: Map<string, CollectionInfo[] | undefined>;
  /** Candidate databases whose collections were not loaded because of the limit. */
  notSearched: number;
  /** Lists still loading. */
  searching: boolean;
}

/**
 * Databases of `connectionIds` and the collections of databases `candidate` accepts.
 * Loads nothing while `candidate` is null (no search going on).
 */
export function useCatalogLists(
  connectionIds: readonly string[],
  candidate: ((database: string) => boolean) | null,
): LoadedCatalog[] {
  const searched = candidate ? connectionIds : [];
  const databaseQueries = useQueries({
    queries: searched.map((connectionId) => ({
      queryKey: catalogKeys.databases(connectionId),
      queryFn: () => unwrap(commands.listDatabases(connectionId)),
      staleTime: SEARCH_STALE_MS,
    })),
  });
  const plans = searched.map((connectionId, index) => {
    const databases = databaseQueries[index]?.data ?? [];
    const candidates = candidate ? databases.filter((database) => candidate(database.name)) : [];
    return { connectionId, databases, candidates };
  });
  const collectionQueries = useQueries({
    queries: plans.flatMap(({ connectionId, candidates }) =>
      candidates.map((database, index) => ({
        queryKey: catalogKeys.collections(connectionId, database.name),
        queryFn: () => unwrap(commands.listCollections(connectionId, database.name)),
        staleTime: SEARCH_STALE_MS,
        // Beyond the limit only collections that are already loaded are searched.
        enabled: index < SEARCH_DATABASE_LIMIT,
      })),
    ),
  });

  // Where each connection's collection queries start in the flat list.
  const starts: number[] = [];
  let total = 0;
  for (const { candidates } of plans) {
    starts.push(total);
    total += candidates.length;
  }
  return plans.map(({ connectionId, databases, candidates }, index) => {
    const start = starts[index] ?? 0;
    const loaded = collectionQueries.slice(start, start + candidates.length);
    return {
      connectionId,
      databases,
      collections: new Map(candidates.map((database, at) => [database.name, loaded[at]?.data])),
      notSearched: loaded
        .slice(SEARCH_DATABASE_LIMIT)
        .filter((query) => query.data === undefined && !query.isFetching).length,
      searching:
        (databaseQueries[index]?.isLoading ?? false) || loaded.some((query) => query.isLoading),
    };
  });
}

/** The sidebar filter's result per connected connection; empty while there is no filter. */
export function useCatalogSearch(
  connectionIds: readonly string[],
  filter: SidebarFilter | null,
): Map<string, CatalogSearch> {
  const lists = useCatalogLists(
    connectionIds,
    filter ? (name) => databaseCandidate(filter, name) : null,
  );
  const results = new Map<string, CatalogSearch>();
  if (!filter) return results;
  for (const { connectionId, databases, collections, notSearched, searching } of lists) {
    const searchable = databases.map((info) => ({ info, collections: collections.get(info.name) }));
    results.set(connectionId, {
      databases: matchDatabases(filter, searchable),
      notSearched,
      searching,
    });
  }
  return results;
}
