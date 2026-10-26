/**
 * Collections and views opened (activated as a tab) in this session, newest first, for
 * "Go to collection". Kept in memory only.
 */
import { useEffect } from "react";
import { create } from "zustand";

import { useTabsStore } from "@/features/workspace";

/** How many recent collections are remembered. */
const RECENT_LIMIT = 20;

export interface RecentCollection {
  connectionId: string;
  database: string;
  collection: string;
}

interface RecentCollectionsState {
  recent: RecentCollection[];
  record: (entry: RecentCollection) => void;
}

const same = (a: RecentCollection, b: RecentCollection) =>
  a.connectionId === b.connectionId && a.database === b.database && a.collection === b.collection;

export const useRecentCollections = create<RecentCollectionsState>()((set) => ({
  recent: [],
  record: (entry) => {
    set((state) => ({
      recent: [entry, ...state.recent.filter((other) => !same(other, entry))].slice(
        0,
        RECENT_LIMIT,
      ),
    }));
  },
}));

/** Records every collection tab that becomes active. Mount once. */
export function useRecordRecentCollections(): void {
  useEffect(
    () =>
      useTabsStore.subscribe((state, previous) => {
        if (state.activeTabId === previous.activeTabId) return;
        const tab = state.tabs.find((open) => open.id === state.activeTabId);
        if (tab?.kind !== "collection") return;
        const { connectionId, database, collection } = tab;
        useRecentCollections.getState().record({ connectionId, database, collection });
      }),
    [],
  );
}
