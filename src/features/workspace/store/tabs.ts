/** Zustand store for the open workspace tabs and which one is active. */
import { create } from "zustand";

import type { WelcomeTab, WorkspaceTab } from "../types";

export const WELCOME_TAB: WelcomeTab = { id: "welcome", kind: "welcome", title: "Welcome" };

interface TabsState {
  tabs: WorkspaceTab[];
  activeTabId: string | null;
  /** Opens the tab, or focuses it if a tab with the same id is already open. */
  openTab: (tab: WorkspaceTab) => void;
  /** Closes the tab and activates its right neighbor (or the new last tab). */
  closeTab: (id: string) => void;
  activateTab: (id: string) => void;
  /** Moves the active tab by `offset`, wrapping around at both ends. */
  cycleTab: (offset: number) => void;
  /** Renames every open tab matching `predicate` (e.g. after renaming a connection). */
  renameTabs: (predicate: (tab: WorkspaceTab) => boolean, title: string) => void;
  /** Closes every open tab matching `predicate` (e.g. after deleting a connection). */
  closeTabs: (predicate: (tab: WorkspaceTab) => boolean) => void;
}

export const useTabsStore = create<TabsState>()((set) => ({
  tabs: [WELCOME_TAB],
  activeTabId: WELCOME_TAB.id,

  openTab: (tab) => {
    set((state) => ({
      tabs: state.tabs.some((open) => open.id === tab.id) ? state.tabs : [...state.tabs, tab],
      activeTabId: tab.id,
    }));
  },

  closeTab: (id) => {
    set((state) => {
      const index = state.tabs.findIndex((tab) => tab.id === id);
      if (index === -1) return state;
      const tabs = state.tabs.filter((tab) => tab.id !== id);
      if (state.activeTabId !== id) return { tabs };
      const neighbor = tabs[Math.min(index, tabs.length - 1)];
      return { tabs, activeTabId: neighbor?.id ?? null };
    });
  },

  activateTab: (id) => {
    set({ activeTabId: id });
  },

  cycleTab: (offset) => {
    set((state) => {
      const count = state.tabs.length;
      if (count === 0) return state;
      const current = state.tabs.findIndex((tab) => tab.id === state.activeTabId);
      const next = (((current + offset) % count) + count) % count;
      return { activeTabId: state.tabs[next]?.id ?? null };
    });
  },

  renameTabs: (predicate, title) => {
    set((state) => ({
      tabs: state.tabs.map((tab) => (predicate(tab) ? { ...tab, title } : tab)),
    }));
  },

  closeTabs: (predicate) => {
    const { tabs, closeTab } = useTabsStore.getState();
    tabs.filter(predicate).forEach((tab) => {
      closeTab(tab.id);
    });
  },
}));

/** The currently active tab, if any. */
export function useActiveTab(): WorkspaceTab | undefined {
  return useTabsStore((state) => state.tabs.find((tab) => tab.id === state.activeTabId));
}
