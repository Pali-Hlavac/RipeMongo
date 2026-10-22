/** Recent and favorite queries of a collection (stored locally by the backend). */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { commands, unwrap } from "@/shared/ipc/client";

import type { CollectionQueries, QueryParts } from "../types";
import { documentKeys, type CollectionTarget } from "./keys";

export function useQueryHistory(target: CollectionTarget) {
  const { connectionId, database, collection } = target;
  return useQuery({
    queryKey: documentKeys.history(target),
    queryFn: () => unwrap(commands.listQueries(connectionId, database, collection)),
  });
}

/** Every history command returns the updated lists; put them straight into the cache. */
function useHistoryMutation<TInput>(
  target: CollectionTarget,
  run: (input: TInput) => Promise<CollectionQueries>,
  silent: boolean,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: run,
    onSuccess: (queries) => {
      queryClient.setQueryData(documentKeys.history(target), queries);
    },
    meta: { silent },
  });
}

/** Remembers a query that ran successfully; failures are not worth interrupting for. */
export function useRecordQuery(target: CollectionTarget) {
  const { connectionId, database, collection } = target;
  return useHistoryMutation(
    target,
    (query: QueryParts) => unwrap(commands.recordQuery(connectionId, database, collection, query)),
    true,
  );
}

export function useSaveFavorite(target: CollectionTarget) {
  const { connectionId, database, collection } = target;
  return useHistoryMutation(
    target,
    ({ name, query }: { name: string; query: QueryParts }) =>
      unwrap(commands.saveFavoriteQuery(connectionId, database, collection, name, query)),
    true,
  );
}

export function useDeleteFavorite(target: CollectionTarget) {
  const { connectionId, database, collection } = target;
  return useHistoryMutation(
    target,
    (id: string) => unwrap(commands.deleteFavoriteQuery(connectionId, database, collection, id)),
    false,
  );
}
