/**
 * Catalog changes: create/drop databases, create/rename/drop collections and views. Each
 * refreshes the cached catalog and keeps open collection tabs in sync. Errors are shown in
 * the dialog that started the change, so mutations are `silent` (no global toast).
 */
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { commands, unwrap } from "@/shared/ipc/client";

import { closeCollectionTabs, renameCollectionTab } from "../lib/tabs";
import type { NewCollectionOptions, NewView } from "../types";
import { catalogKeys } from "./keys";

const SILENT = { silent: true };

/** Shared refresh: everything of a connection, or one database when known. */
function useRefreshCatalog() {
  const queryClient = useQueryClient();
  return (connectionId: string, database?: string) =>
    queryClient.invalidateQueries({
      queryKey:
        database === undefined
          ? catalogKeys.connection(connectionId)
          : catalogKeys.database(connectionId, database),
    });
}

interface DatabaseTarget {
  connectionId: string;
  database: string;
}

interface CollectionTarget extends DatabaseTarget {
  collection: string;
}

interface RenameInput extends CollectionTarget {
  newName: string;
}

export function useCreateDatabase() {
  const refresh = useRefreshCatalog();
  return useMutation({
    mutationFn: ({ connectionId, database, collection }: CollectionTarget) =>
      unwrap(commands.createDatabase(connectionId, database, collection)),
    onSuccess: (_result, { connectionId, database }) => {
      toast.success(`Created database "${database}"`);
      return refresh(connectionId);
    },
    meta: SILENT,
  });
}

export function useDropDatabase() {
  const queryClient = useQueryClient();
  const refresh = useRefreshCatalog();
  return useMutation({
    mutationFn: ({ connectionId, database }: DatabaseTarget) =>
      unwrap(commands.dropDatabase(connectionId, database)),
    onSuccess: (_result, { connectionId, database }) => {
      closeCollectionTabs(connectionId, database);
      queryClient.removeQueries({ queryKey: catalogKeys.database(connectionId, database) });
      toast.success(`Dropped database "${database}"`);
      return refresh(connectionId);
    },
    meta: SILENT,
  });
}

export function useCreateCollection() {
  const refresh = useRefreshCatalog();
  return useMutation({
    mutationFn: ({
      connectionId,
      database,
      collection,
      options,
    }: CollectionTarget & { options: NewCollectionOptions }) =>
      unwrap(commands.createCollection(connectionId, database, collection, options)),
    onSuccess: (_result, { connectionId, collection }) => {
      toast.success(`Created collection "${collection}"`);
      // A new collection can create its database too, so refresh the database list as well.
      return refresh(connectionId);
    },
    meta: SILENT,
  });
}

export function useCreateView() {
  const refresh = useRefreshCatalog();
  return useMutation({
    mutationFn: ({ connectionId, database, view }: DatabaseTarget & { view: NewView }) =>
      unwrap(commands.createView(connectionId, database, view)),
    onSuccess: (_result, { connectionId, view }) => {
      toast.success(`Created view "${view.name}"`);
      return refresh(connectionId);
    },
    meta: SILENT,
  });
}

export function useRenameCollection() {
  const refresh = useRefreshCatalog();
  return useMutation({
    mutationFn: ({ connectionId, database, collection, newName }: RenameInput) =>
      unwrap(commands.renameCollection(connectionId, database, collection, newName)),
    onSuccess: (_result, { connectionId, database, collection, newName }) => {
      renameCollectionTab(connectionId, database, collection, newName);
      toast.success(`Renamed "${collection}" to "${newName}"`);
      return refresh(connectionId, database);
    },
    meta: SILENT,
  });
}

export function useDropCollection() {
  const refresh = useRefreshCatalog();
  return useMutation({
    mutationFn: ({ connectionId, database, collection }: CollectionTarget) =>
      unwrap(commands.dropCollection(connectionId, database, collection)),
    onSuccess: (_result, { connectionId, database, collection }) => {
      closeCollectionTabs(connectionId, database, collection);
      toast.success(`Dropped "${collection}"`);
      // Dropping the last collection removes the database, so refresh the whole connection.
      return refresh(connectionId);
    },
    meta: SILENT,
  });
}
