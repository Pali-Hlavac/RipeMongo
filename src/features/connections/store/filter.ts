/** Text in the sidebar filter box; blank shows everything. */
import { create } from "zustand";

interface SidebarFilterState {
  input: string;
  setInput: (input: string) => void;
}

export const useSidebarFilter = create<SidebarFilterState>()((set) => ({
  input: "",
  setInput: (input) => {
    set({ input });
  },
}));
