/** Whether the background jobs panel is open. */
import { create } from "zustand";

interface JobsPanelState {
  open: boolean;
  setOpen: (open: boolean) => void;
}

export const useJobsPanel = create<JobsPanelState>()((set) => ({
  open: false,
  setOpen: (open) => {
    set({ open });
  },
}));
