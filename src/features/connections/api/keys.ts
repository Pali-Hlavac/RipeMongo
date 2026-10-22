/** TanStack Query keys for the connections feature. */
export const connectionKeys = {
  all: ["connections"] as const,
  list: () => [...connectionKeys.all, "list"] as const,
  active: () => [...connectionKeys.all, "active"] as const,
  storedSecrets: (connectionId: string) =>
    [...connectionKeys.all, "stored-secrets", connectionId] as const,
};
