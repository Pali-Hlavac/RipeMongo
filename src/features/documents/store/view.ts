/** Per-tab state of a collection tab: view mode, paging and the applied query. */
import { create } from "zustand";

import type { QueryParts } from "../types";

export type DocumentView = "list" | "json" | "table";

export const PAGE_SIZES = [10, 20, 50, 100, 250, 500, 1000] as const;
export const DEFAULT_PAGE_SIZE = 20;
/** Server-side limit for loading a page, so a slow query never hangs the tab. */
export const DEFAULT_MAX_TIME_MS = 60_000;

/** The query the documents were loaded with (edits in the query bar apply on Find). */
export interface AppliedQuery extends QueryParts {
  /** Documents to skip before the first page (on top of paging). */
  skip: number;
  /** Most documents to return in total across pages; 0 means no limit. */
  limit: number;
  /** Server-side time limit per page; 0 means none. */
  maxTimeMs: number;
}

export const EMPTY_QUERY: AppliedQuery = {
  filter: "",
  projection: "",
  sort: "",
  collation: "",
  skip: 0,
  limit: 0,
  maxTimeMs: DEFAULT_MAX_TIME_MS,
};

export interface CollectionViewState {
  view: DocumentView;
  pageSize: number;
  skip: number;
  query: AppliedQuery;
}

export const DEFAULT_VIEW_STATE: CollectionViewState = {
  view: "list",
  pageSize: DEFAULT_PAGE_SIZE,
  skip: 0,
  query: EMPTY_QUERY,
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
