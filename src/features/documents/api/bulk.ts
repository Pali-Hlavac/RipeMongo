/** Bulk update / delete by filter: previews (queries) and the writes (mutations). */
import { useMutation, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";

import { commands, unwrap } from "@/shared/ipc/client";
import { formatCount } from "@/shared/lib/format";

import { documentKeys, type CollectionTarget } from "./keys";
import { useRefreshCollection } from "./mutations";

/** What a bulk dialog previews and then applies. */
export interface BulkInput {
  filter: string;
  /** Update operators or pipeline; unused for deletes. */
  update: string;
}

const PREVIEW_OPTIONS = { retry: false, gcTime: 0, staleTime: Infinity } as const;

/** Preview of an update; `input` is `null` until the user asks for one. */
export function useUpdatePreview(target: CollectionTarget, input: BulkInput | null) {
  const { connectionId, database, collection } = target;
  return useQuery({
    queryKey: documentKeys.updatePreview(target, input?.filter ?? "", input?.update ?? ""),
    queryFn: () =>
      unwrap(
        commands.previewUpdateMany(
          connectionId,
          database,
          collection,
          input?.filter ?? "",
          input?.update ?? "",
        ),
      ),
    enabled: input !== null,
    ...PREVIEW_OPTIONS,
  });
}

export function useDeletePreview(target: CollectionTarget, filter: string) {
  const { connectionId, database, collection } = target;
  return useQuery({
    queryKey: documentKeys.deletePreview(target, filter),
    queryFn: () => unwrap(commands.previewDeleteMany(connectionId, database, collection, filter)),
    ...PREVIEW_OPTIONS,
  });
}

export function useUpdateMany(target: CollectionTarget) {
  const refresh = useRefreshCollection(target);
  const { connectionId, database, collection } = target;
  return useMutation({
    mutationFn: ({ filter, update }: BulkInput) =>
      unwrap(commands.updateMany(connectionId, database, collection, filter, update)),
    onSuccess: ({ matched, modified }) => {
      toast.success(
        `Updated ${formatCount(modified ?? 0)} of ${formatCount(matched ?? 0)} matching documents`,
      );
      return refresh();
    },
    meta: { silent: true },
  });
}

export function useDeleteMany(target: CollectionTarget) {
  const refresh = useRefreshCollection(target);
  const { connectionId, database, collection } = target;
  return useMutation({
    mutationFn: (filter: string) =>
      unwrap(commands.deleteMany(connectionId, database, collection, filter)),
    onSuccess: (deleted) => {
      toast.success(
        deleted === 1 ? "Deleted 1 document" : `Deleted ${formatCount(deleted ?? 0)} documents`,
      );
      return refresh();
    },
    meta: { silent: true },
  });
}
