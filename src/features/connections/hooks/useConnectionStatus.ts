import { useActiveConnections } from "../api/session";
import { resolveStatus, useConnectionStatusStore, type ConnectionStatus } from "../store/status";
import type { ActiveConnectionInfo } from "../types";

/** Live status of one connection plus its server info when connected. */
export function useConnectionStatus(connectionId: string): {
  status: ConnectionStatus;
  active: ActiveConnectionInfo | undefined;
} {
  const { data: activeConnections = [] } = useActiveConnections();
  const pending = useConnectionStatusStore((state) => state.pending[connectionId]);
  const active = activeConnections.find((info) => info.connectionId === connectionId);
  return { status: resolveStatus(active !== undefined, pending), active };
}
