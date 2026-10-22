/** Which databases are expanded in the sidebar; survives collapsing their connection. */
import { create } from "zustand";

interface ExpandedDatabasesState {
  expanded: Record<string, boolean | undefined>;
  toggle: (connectionId: string, database: string) => void;
}

/** Store key; the null character cannot appear in connection ids or database names. */
export function databaseKey(connectionId: string, database: string): string {
  return `${connectionId}\u0000${database}`;
}

export const useExpandedDatabases = create<ExpandedDatabasesState>()((set) => ({
  expanded: {},
  toggle: (connectionId, database) => {
    const key = databaseKey(connectionId, database);
    set((state) => ({ expanded: { ...state.expanded, [key]: !state.expanded[key] } }));
  },
}));

export function useIsDatabaseExpanded(connectionId: string, database: string): boolean {
  return useExpandedDatabases(
    (state) => state.expanded[databaseKey(connectionId, database)] ?? false,
  );
}
