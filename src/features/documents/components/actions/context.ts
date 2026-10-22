/** What the document views may do with a document; provided by `DocumentActionsProvider`. */
import { createContext, useContext } from "react";

import type { BsonValue } from "../../lib/bson";
import type { LoadedDocument } from "../../types";

export interface DocumentActions {
  /** Views and read-only collections cannot be written. */
  readOnly: boolean;
  /**
   * A projection hides fields, so saving a whole loaded document would delete them; whole
   * document edits and clones are disabled then (single-field edits stay safe).
   */
  projected: boolean;
  insert: () => void;
  edit: (document: LoadedDocument) => void;
  clone: (document: LoadedDocument) => void;
  remove: (document: LoadedDocument) => void;
  /** Saves one field typed in shell syntax; resolves when saved, rejects on failure. */
  setField: (
    document: LoadedDocument,
    path: string,
    original: BsonValue,
    text: string,
  ) => Promise<void>;
}

const READ_ONLY: DocumentActions = {
  readOnly: true,
  projected: false,
  insert: () => undefined,
  edit: () => undefined,
  clone: () => undefined,
  remove: () => undefined,
  setField: () => Promise.resolve(),
};

export const DocumentActionsContext = createContext<DocumentActions>(READ_ONLY);

export function useDocumentActions(): DocumentActions {
  return useContext(DocumentActionsContext);
}

/** The document a list card or JSON block belongs to (for nested field rows). */
export const CurrentDocumentContext = createContext<LoadedDocument | null>(null);
