/**
 * Rows opened or closed by hand while the sidebar filter is active. The filter opens rows
 * with matches inside; these overrides let the user close them again. They belong to one
 * filter text and start over when it changes, leaving the normal expanded state untouched.
 */
import { create } from "zustand";

interface FilterExpandedState {
  text: string;
  overrides: Record<string, boolean | undefined>;
  setExpanded: (text: string, key: string, expanded: boolean) => void;
}

export const useFilterExpandedStore = create<FilterExpandedState>()((set) => ({
  text: "",
  overrides: {},
  setExpanded: (text, key, expanded) => {
    set((state) => ({
      text,
      overrides: { ...(state.text === text ? state.overrides : {}), [key]: expanded },
    }));
  },
}));

/** Whether a row is open while filtering by `text`; `byFilter` unless the user toggled it. */
export function useFilterExpanded(key: string, text: string, byFilter: boolean): boolean {
  return useFilterExpandedStore((state) =>
    state.text === text ? (state.overrides[key] ?? byFilter) : byFilter,
  );
}
