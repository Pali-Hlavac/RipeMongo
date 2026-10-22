/** TanStack Query keys for documents. */
import type { FindRequest } from "../types";

export interface CollectionTarget {
  connectionId: string;
  database: string;
  collection: string;
}

export const documentKeys = {
  /** Everything cached for one connection; removed on disconnect. */
  connection: (connectionId: string) => ["documents", connectionId] as const,
  collection: ({ connectionId, database, collection }: CollectionTarget) =>
    [...documentKeys.connection(connectionId), database, collection] as const,
  page: (target: CollectionTarget, request: FindRequest) =>
    [...documentKeys.collection(target), "page", request] as const,
  count: (target: CollectionTarget, filter: string) =>
    [...documentKeys.collection(target), "count", filter] as const,
  /** Bulk previews; outside `collection` so refreshing pages after a write skips them. */
  updatePreview: (
    { connectionId, database, collection }: CollectionTarget,
    filter: string,
    update: string,
  ) => ["bulk-preview", "update", connectionId, database, collection, filter, update] as const,
  deletePreview: ({ connectionId, database, collection }: CollectionTarget, filter: string) =>
    ["bulk-preview", "delete", connectionId, database, collection, filter] as const,
  /** Saved queries live on disk, not on the server; kept apart from page data. */
  history: ({ connectionId, database, collection }: CollectionTarget) =>
    ["query-history", connectionId, database, collection] as const,
};
