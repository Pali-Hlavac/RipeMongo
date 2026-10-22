/** Read queries for databases, collections and collection statistics. */
import { useQuery } from "@tanstack/react-query";

import { commands, unwrap } from "@/shared/ipc/client";

import { catalogKeys } from "./keys";

/** Statistics change with every write; refetch them at most this often while visible. */
const STATS_STALE_MS = 30_000;

/** Databases of a connected server. Mount only for connected connections. */
export function useDatabases(connectionId: string) {
  return useQuery({
    queryKey: catalogKeys.databases(connectionId),
    queryFn: () => unwrap(commands.listDatabases(connectionId)),
  });
}

/** Collections and views of one database. */
export function useCollections(connectionId: string, database: string) {
  return useQuery({
    queryKey: catalogKeys.collections(connectionId, database),
    queryFn: () => unwrap(commands.listCollections(connectionId, database)),
  });
}

/** One collection's entry from the list (kind, view source, read-only), once loaded. */
export function useCollectionInfo(connectionId: string, database: string, collection: string) {
  const { data } = useCollections(connectionId, database);
  return data?.find((candidate) => candidate.name === collection);
}

/** Document count and sizes; `enabled: false` for views, which have no storage. */
export function useCollectionStats(
  connectionId: string,
  database: string,
  collection: string,
  enabled = true,
) {
  return useQuery({
    queryKey: catalogKeys.stats(connectionId, database, collection),
    queryFn: () => unwrap(commands.collectionStats(connectionId, database, collection)),
    staleTime: STATS_STALE_MS,
    enabled,
  });
}
