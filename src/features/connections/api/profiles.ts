/** Queries and mutations for saved connection profiles. */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { useTabsStore } from "@/features/workspace";
import { commands, unwrap } from "@/shared/ipc/client";

import { KEEP_ALL_SECRETS } from "../lib/secrets";
import type { ConnectionProfile, SecretUpdates } from "../types";
import { connectionKeys } from "./keys";

/** All saved connections. */
export function useConnections() {
  return useQuery({
    queryKey: connectionKeys.list(),
    queryFn: () => unwrap(commands.listConnections()),
  });
}

/** Which secrets are stored for a connection (never their values). */
export function useStoredSecrets(connectionId: string | null) {
  return useQuery({
    queryKey: connectionKeys.storedSecrets(connectionId ?? ""),
    queryFn: () => unwrap(commands.getStoredSecrets(connectionId ?? "")),
    enabled: connectionId !== null,
  });
}

interface SaveInput {
  profile: ConnectionProfile;
  secrets?: SecretUpdates;
}

/** Creates or updates a connection; keeps open tab titles in sync with its name. */
export function useSaveConnection() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ profile, secrets = KEEP_ALL_SECRETS }: SaveInput) =>
      unwrap(commands.saveConnection(profile, secrets)),
    onSuccess: (saved) => {
      useTabsStore
        .getState()
        .renameTabs(
          (tab) => tab.kind === "connection" && tab.connectionId === saved.id,
          saved.name,
        );
      void queryClient.invalidateQueries({ queryKey: connectionKeys.all });
    },
  });
}

/** Deletes a connection and closes its tabs. */
export function useDeleteConnection() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (connectionId: string) => unwrap(commands.deleteConnection(connectionId)),
    onSuccess: (_result, connectionId) => {
      useTabsStore
        .getState()
        .closeTabs((tab) => tab.kind === "connection" && tab.connectionId === connectionId);
      void queryClient.invalidateQueries({ queryKey: connectionKeys.all });
    },
  });
}

/** Copies a connection including its secrets. */
export function useDuplicateConnection() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (connectionId: string) => unwrap(commands.duplicateConnection(connectionId)),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: connectionKeys.list() });
    },
  });
}
