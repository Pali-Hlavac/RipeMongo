/** TanStack Query keys for the tools feature. */
export const toolsKeys = {
  all: ["tools"] as const,
  dumpProfiles: () => [...toolsKeys.all, "dump-profiles"] as const,
  collections: (connectionId: string, database: string | null) =>
    [...toolsKeys.all, "collections", connectionId, database] as const,
};
