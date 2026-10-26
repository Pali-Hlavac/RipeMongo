import type { RestoreSource } from "@/shared/ipc/bindings";

/** TanStack Query keys for the tools feature. */
export const toolsKeys = {
  all: ["tools"] as const,
  dumpProfiles: () => [...toolsKeys.all, "dump-profiles"] as const,
  collections: (connectionId: string, database: string | null) =>
    [...toolsKeys.all, "collections", connectionId, database] as const,
  dumpContents: (source: RestoreSource | null) =>
    [...toolsKeys.all, "dump-contents", source] as const,
  importPreview: (path: string | null, delimiter: string | null) =>
    [...toolsKeys.all, "import-preview", path, delimiter] as const,
  connections: () => [...toolsKeys.all, "connections"] as const,
  fields: (connectionId: string, database: string, collection: string) =>
    [...toolsKeys.all, "fields", connectionId, database, collection] as const,
};
