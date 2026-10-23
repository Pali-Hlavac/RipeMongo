/** Which dump or restore dialog is open, and for what. */
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

/** The connection a restore goes into; its name is what "drop" asks the user to type. */
export interface RestoreTarget {
  connectionId: string;
  connectionName: string;
}

interface RestoreDialogState {
  target: RestoreTarget | null;
  open: (target: RestoreTarget) => void;
  close: () => void;
}

export const useRestoreDialog = create<RestoreDialogState>()((set) => ({
  target: null,
  open: (target) => {
    set({ target });
  },
  close: () => {
    set({ target: null });
  },
}));
