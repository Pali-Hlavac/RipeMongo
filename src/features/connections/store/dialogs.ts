/** Which connection dialog is open (editor, delete confirmation, import/export). */
import { create } from "zustand";

export type EditorState =
  { mode: "closed" } | { mode: "create" } | { mode: "edit"; connectionId: string };

export type TransferMode = "import" | "export";

interface ConnectionDialogsState {
  editor: EditorState;
  /** Connection awaiting delete confirmation. */
  deleteTargetId: string | null;
  transfer: TransferMode | null;
  openCreate: () => void;
  openEdit: (connectionId: string) => void;
  closeEditor: () => void;
  setDeleteTarget: (connectionId: string | null) => void;
  setTransfer: (mode: TransferMode | null) => void;
}

export const useConnectionDialogs = create<ConnectionDialogsState>()((set) => ({
  editor: { mode: "closed" },
  deleteTargetId: null,
  transfer: null,
  openCreate: () => {
    set({ editor: { mode: "create" } });
  },
  openEdit: (connectionId) => {
    set({ editor: { mode: "edit", connectionId } });
  },
  closeEditor: () => {
    set({ editor: { mode: "closed" } });
  },
  setDeleteTarget: (connectionId) => {
    set({ deleteTargetId: connectionId });
  },
  setTransfer: (mode) => {
    set({ transfer: mode });
  },
}));
