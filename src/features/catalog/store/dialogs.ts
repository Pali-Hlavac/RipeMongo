/** Which catalog dialog is open. Only one can be open at a time. */
import { create } from "zustand";

import type { CollectionKind } from "../types";

export type CatalogDialog =
  | { type: "createDatabase"; connectionId: string }
  | {
      type: "createCollection";
      connectionId: string;
      database: string;
      /** Preselects "view" with this source collection ("Create view…" on a collection). */
      viewOn?: string;
    }
  | { type: "renameCollection"; connectionId: string; database: string; collection: string }
  | { type: "dropDatabase"; connectionId: string; database: string }
  | {
      type: "dropCollection";
      connectionId: string;
      database: string;
      collection: string;
      kind: CollectionKind;
    };

interface CatalogDialogsState {
  dialog: CatalogDialog | null;
  open: (dialog: CatalogDialog) => void;
  close: () => void;
}

export const useCatalogDialogs = create<CatalogDialogsState>()((set) => ({
  dialog: null,
  open: (dialog) => {
    set({ dialog });
  },
  close: () => {
    set({ dialog: null });
  },
}));

/** The open dialog if it has the given type, for typed access in each dialog component. */
export function useCatalogDialog<T extends CatalogDialog["type"]>(
  type: T,
): Extract<CatalogDialog, { type: T }> | null {
  return useCatalogDialogs((state) =>
    state.dialog?.type === type ? (state.dialog as Extract<CatalogDialog, { type: T }>) : null,
  );
}
