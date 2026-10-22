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
};
