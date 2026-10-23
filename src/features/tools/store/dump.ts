/** Which server, database or collection the dump dialog is open for, and the saved dumps list. */
import { create } from "zustand";

import type { DumpProfile } from "@/shared/ipc/bindings";

import { targetOf } from "../lib/dump";

/** `database: null` dumps the whole server; `collection` requires `database`. */
export interface DumpTarget {
  connectionId: string;
  database: string | null;
  collection: string | null;
}

interface DumpDialogState {
  target: DumpTarget | null;
  /** Set when the dialog edits a saved dump. */
  profile: DumpProfile | null;
  open: (target: DumpTarget) => void;
  edit: (profile: DumpProfile) => void;
  close: () => void;
}

export const useDumpDialog = create<DumpDialogState>()((set) => ({
  target: null,
  profile: null,
  open: (target) => {
    set({ target, profile: null });
  },
  edit: (profile) => {
    set({ target: targetOf(profile.connectionId, profile.request), profile });
  },
  close: () => {
    set({ target: null, profile: null });
  },
}));

interface SavedDumpsState {
  open: boolean;
  setOpen: (open: boolean) => void;
}

export const useSavedDumpsDialog = create<SavedDumpsState>()((set) => ({
  open: false,
  setOpen: (open) => {
    set({ open });
  },
}));
