/** Which server, database or collection the dump dialog is open for. */
import { create } from "zustand";

/** `database: null` dumps the whole server; `collection` requires `database`. */
export interface DumpTarget {
  connectionId: string;
  database: string | null;
  collection: string | null;
}

interface DumpDialogState {
  target: DumpTarget | null;
  open: (target: DumpTarget) => void;
  close: () => void;
}

export const useDumpDialog = create<DumpDialogState>()((set) => ({
  target: null,
  open: (target) => {
    set({ target });
  },
  close: () => {
    set({ target: null });
  },
}));
