/** Which connected connections show their database tree in the sidebar. */
import { create } from "zustand";

interface ExpandedConnectionsState {
  expanded: Record<string, boolean | undefined>;
  setExpanded: (connectionId: string, expanded: boolean) => void;
}

export const useExpandedConnections = create<ExpandedConnectionsState>()((set) => ({
  expanded: {},
  setExpanded: (connectionId, expanded) => {
    set((state) => ({ expanded: { ...state.expanded, [connectionId]: expanded } }));
  },
}));
