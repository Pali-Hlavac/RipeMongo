/** Open/closed state of the "Go to collection" picker. */
import { create } from "zustand";

interface GoToCollectionState {
  open: boolean;
  setOpen: (open: boolean) => void;
  toggle: () => void;
}

export const useGoToCollection = create<GoToCollectionState>()((set) => ({
  open: false,
  setOpen: (open) => {
    set({ open });
  },
  toggle: () => {
    set((state) => ({ open: !state.open }));
  },
}));
