/** TanStack Query keys for the catalog (databases and collections of a live connection). */
export const catalogKeys = {
  /** Everything cached for one connection; removed on disconnect. */
  connection: (connectionId: string) => ["catalog", connectionId] as const,
  databases: (connectionId: string) =>
    [...catalogKeys.connection(connectionId), "databases"] as const,
  database: (connectionId: string, database: string) =>
    [...catalogKeys.connection(connectionId), "database", database] as const,
  collections: (connectionId: string, database: string) =>
    [...catalogKeys.database(connectionId, database), "collections"] as const,
  stats: (connectionId: string, database: string, collection: string) =>
    [...catalogKeys.database(connectionId, database), "stats", collection] as const,
};
