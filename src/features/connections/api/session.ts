/** Live connections: list, open, close and test. */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { catalogKeys } from "@/features/catalog";
import { documentKeys } from "@/features/documents";
import { useTabsStore } from "@/features/workspace";
import { commands, toIpcError, unwrap } from "@/shared/ipc/client";

import { useExpandedConnections } from "../store/expanded";
import { useConnectionStatusStore } from "../store/status";
import type { ConnectionConfig, ConnectionProfile, SecretUpdates } from "../types";
import { connectionKeys } from "./keys";

/** Connections that are currently open. */
export function useActiveConnections() {
  return useQuery({
    queryKey: connectionKeys.active(),
    queryFn: () => unwrap(commands.listActiveConnections()),
  });
}

/** Id of the workspace tab showing a connection's overview. */
export function connectionTabId(connectionId: string): string {
  return `connection:${connectionId}`;
}

/** Opens (or focuses) the overview tab of a connection. */
export function openConnectionTab(profile: ConnectionProfile): void {
  useTabsStore.getState().openTab({
    id: connectionTabId(profile.id),
    kind: "connection",
    connectionId: profile.id,
    title: profile.name,
  });
}

/**
 * Connect and disconnect actions. Connecting opens the overview tab right away; progress
 * and errors are tracked per connection so the sidebar and tab can show them. A successful
 * connect expands the connection's database tree; disconnecting drops its cached catalog.
 */
export function useConnectionSession() {
  const queryClient = useQueryClient();
  const setPending = useConnectionStatusStore((state) => state.setPending);
  const refreshActive = () => queryClient.invalidateQueries({ queryKey: connectionKeys.active() });

  const connect = async (profile: ConnectionProfile): Promise<void> => {
    openConnectionTab(profile);
    setPending(profile.id, { state: "connecting" });
    try {
      await unwrap(commands.openConnection(profile.id));
      setPending(profile.id, null);
      useExpandedConnections.getState().setExpanded(profile.id, true);
    } catch (error) {
      setPending(profile.id, { state: "failed", error: toIpcError(error) });
    } finally {
      await refreshActive();
    }
  };

  const disconnect = async (connectionId: string): Promise<void> => {
    setPending(connectionId, null);
    try {
      await unwrap(commands.closeConnection(connectionId));
    } catch (error) {
      const { message, hint } = toIpcError(error);
      toast.error(message, { description: hint ?? undefined });
    } finally {
      await refreshActive();
      // After the refresh, so the tree has unmounted and nothing refetches the dropped data.
      queryClient.removeQueries({ queryKey: catalogKeys.connection(connectionId) });
      queryClient.removeQueries({ queryKey: documentKeys.connection(connectionId) });
    }
  };

  return { connect, disconnect };
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

/**
 * Opens a connection unless it is already open (for actions started outside the sidebar, like
 * a saved dump). Throws the connection error when it cannot connect.
 */
export function useEnsureConnected() {
  const queryClient = useQueryClient();
  return async (connectionId: string): Promise<void> => {
    const active = await queryClient.query({
      queryKey: connectionKeys.active(),
      queryFn: () => unwrap(commands.listActiveConnections()),
    });
    if (active.some((connection) => connection.connectionId === connectionId)) return;
    try {
      await unwrap(commands.openConnection(connectionId));
      useExpandedConnections.getState().setExpanded(connectionId, true);
    } finally {
      await queryClient.invalidateQueries({ queryKey: connectionKeys.active() });
    }
  };
}
