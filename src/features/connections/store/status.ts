/**
 * Transient per-connection state that the backend does not track: "connecting" while an
 * open request is in flight, and the last connect error. "Connected" comes from the
 * active-connections query instead.
 */
import { create } from "zustand";

import type { IpcError } from "@/shared/ipc/client";

export type PendingStatus = { state: "connecting" } | { state: "failed"; error: IpcError };

interface ConnectionStatusState {
  pending: Record<string, PendingStatus | undefined>;
  setPending: (connectionId: string, status: PendingStatus | null) => void;
}

export const useConnectionStatusStore = create<ConnectionStatusState>()((set) => ({
  pending: {},
  setPending: (connectionId, status) => {
    set((state) => ({ pending: { ...state.pending, [connectionId]: status ?? undefined } }));
  },
}));

/** Effective status of one connection, for status dots and the overview tab. */
export type ConnectionStatus = "disconnected" | "connecting" | "connected" | "failed";

/** Human-readable status, used as accessible label and in the overview header. */
export const STATUS_LABELS: Record<ConnectionStatus, string> = {
  disconnected: "Disconnected",
  connecting: "Connecting",
  connected: "Connected",
  failed: "Connection failed",
};

export function resolveStatus(
  connected: boolean,
  pending: PendingStatus | undefined,
): ConnectionStatus {
  if (pending?.state === "connecting") return "connecting";
  if (connected) return "connected";
  return pending?.state === "failed" ? "failed" : "disconnected";
}
