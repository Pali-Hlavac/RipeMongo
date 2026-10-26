/** What "Find on this page" highlights, shared with the document views. */
import { createContext, useContext } from "react";

export interface FindState {
  /** The text to find; empty while find is closed. */
  needle: string;
  /** Id of the current hit (see `lib/find.ts`). */
  current: string | null;
  /** Index of the document holding the current hit. */
  currentDocument: number | null;
  /** List view: objects and arrays to open because they contain hits (`pathKey`). */
  open: ReadonlySet<string>;
  /** List view: top-level fields that are or contain hits (`pathKey`). */
  fields: ReadonlySet<string>;
}

const NOTHING: FindState = {
  needle: "",
  current: null,
  currentDocument: null,
  open: new Set(),
  fields: new Set(),
};

export const FindContext = createContext<FindState>(NOTHING);

export function useFind(): FindState {
  return useContext(FindContext);
}
