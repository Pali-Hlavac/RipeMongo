/** Live connections: open, close, list and test. */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { commands, unwrap } from "@/shared/ipc/client";

import type { ConnectionConfig, SecretUpdates } from "../types";
import { connectionKeys } from "./keys";

/** Connections that are currently open. */
export function useActiveConnections() {
  return useQuery({
    queryKey: connectionKeys.active(),
    queryFn: () => unwrap(commands.listActiveConnections()),
  });
}

/** Opens a saved connection. Errors are shown by the caller next to the connection. */
export function useOpenConnection() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (connectionId: string) => unwrap(commands.openConnection(connectionId)),
    meta: { silent: true },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: connectionKeys.active() });
    },
  });
}

/** Closes a live connection. */
export function useCloseConnection() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (connectionId: string) => unwrap(commands.closeConnection(connectionId)),
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: connectionKeys.active() });
    },
  });
}

interface TestInput {
  config: ConnectionConfig;
  connectionId: string | null;
  secrets: SecretUpdates;
}

/** Tries unsaved settings; the result is rendered inline in the editor. */
export function useTestConnection() {
  return useMutation({
    mutationFn: ({ config, connectionId, secrets }: TestInput) =>
      unwrap(commands.testConnection(config, connectionId, secrets)),
    meta: { silent: true },
  });
}
