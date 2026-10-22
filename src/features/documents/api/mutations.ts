/** Document writes. Each refreshes the loaded pages and the collection's statistics. */
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { catalogKeys } from "@/features/catalog";
import { commands, unwrap } from "@/shared/ipc/client";

import type { FieldEdit } from "../types";
import { documentKeys, type CollectionTarget } from "./keys";

function useRefresh(target: CollectionTarget) {
  const queryClient = useQueryClient();
  return () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: documentKeys.collection(target) }),
      queryClient.invalidateQueries({
        queryKey: catalogKeys.database(target.connectionId, target.database),
      }),
    ]);
}

/** Inserts the documents typed in the editor (one or an array). Errors show in the dialog. */
export function useInsertDocuments(target: CollectionTarget) {
  const refresh = useRefresh(target);
  const { connectionId, database, collection } = target;
  return useMutation({
    mutationFn: (text: string) =>
      unwrap(commands.insertDocuments(connectionId, database, collection, text)),
    onSuccess: (count) => {
      toast.success(count === 1 ? "Inserted 1 document" : `Inserted ${count} documents`);
      return refresh();
    },
    meta: { silent: true },
  });
}

interface ReplaceInput {
  /** `_id` as canonical Extended JSON. */
  id: string;
  /** The document as loaded (canonical JSON), to detect concurrent changes. */
  original: string;
  text: string;
}

export function useReplaceDocument(target: CollectionTarget) {
  const refresh = useRefresh(target);
  const { connectionId, database, collection } = target;
  return useMutation({
    mutationFn: ({ id, original, text }: ReplaceInput) =>
      unwrap(commands.replaceDocument(connectionId, database, collection, id, original, text)),
    onSuccess: () => {
      toast.success("Document saved");
      return refresh();
    },
    meta: { silent: true },
  });
}

/** Inline edit of one field; failures (e.g. a conflict) appear as a toast. */
export function useSetField(target: CollectionTarget) {
  const refresh = useRefresh(target);
  const { connectionId, database, collection } = target;
  return useMutation({
    mutationFn: (edit: FieldEdit) =>
      unwrap(commands.setDocumentField(connectionId, database, collection, edit)),
    onSuccess: () => refresh(),
  });
}

export function useDeleteDocument(target: CollectionTarget) {
  const refresh = useRefresh(target);
  const { connectionId, database, collection } = target;
  return useMutation({
    mutationFn: (id: string) =>
      unwrap(commands.deleteDocument(connectionId, database, collection, id)),
    onSuccess: () => {
      toast.success("Document deleted");
      return refresh();
    },
    meta: { silent: true },
  });
}
