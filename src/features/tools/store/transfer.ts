/** Which export dialog is open, and for what. */
import { create } from "zustand";

/** The query of a documents tab, carried into an export. */
export interface ExportQuery {
  filter: string;
  sort: string;
  skip: number;
  /** 0 means no limit. */
  limit: number;
  /** Not used by exports (fields are chosen in the dialog); shown as a note when set. */
  projection: string;
}

export interface ExportTarget {
  connectionId: string;
  database: string;
  collection: string;
  /** Set when opened from a documents tab. */
  query?: ExportQuery;
}

interface ExportDialogState {
  target: ExportTarget | null;
  open: (target: ExportTarget) => void;
  close: () => void;
}

export const useExportDialog = create<ExportDialogState>()((set) => ({
  target: null,
  open: (target) => {
    set({ target });
  },
  close: () => {
    set({ target: null });
  },
}));
