/** Per-tab view settings of a collection tab: view mode and paging. */
import { create } from "zustand";

export type DocumentView = "list" | "json" | "table";

export const PAGE_SIZES = [10, 20, 50, 100, 250, 500, 1000] as const;
export const DEFAULT_PAGE_SIZE = 20;

export interface CollectionViewState {
  view: DocumentView;
  pageSize: number;
  skip: number;
}

export const DEFAULT_VIEW_STATE: CollectionViewState = {
  view: "list",
  pageSize: DEFAULT_PAGE_SIZE,
  skip: 0,
};

interface CollectionViewStore {
  states: Record<string, CollectionViewState | undefined>;
  update: (tabId: string, patch: Partial<CollectionViewState>) => void;
}

export const useCollectionViewStore = create<CollectionViewStore>()((set) => ({
  states: {},
  update: (tabId, patch) => {
    set((store) => ({
      states: {
        ...store.states,
        [tabId]: { ...(store.states[tabId] ?? DEFAULT_VIEW_STATE), ...patch },
      },
    }));
  },
}));

/** View settings of one tab (defaults until changed) and a setter. */
export function useCollectionView(tabId: string) {
  const state = useCollectionViewStore((store) => store.states[tabId] ?? DEFAULT_VIEW_STATE);
  const update = useCollectionViewStore((store) => store.update);
  const set = (patch: Partial<CollectionViewState>) => {
    update(tabId, patch);
  };
  return [state, set] as const;
}
