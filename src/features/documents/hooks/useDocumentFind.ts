/**
 * "Find on this page" for a collection tab: open state, the text, the hits of the current
 * view and which one is current. Ctrl/Cmd+F opens it (not while a dialog is open).
 */
import { useEffect, useMemo, useRef, useState } from "react";

import { useHotkey } from "@/shared/hooks/useHotkey";
import { isDialogOpen } from "@/shared/lib/dialogs";

import type { FindState } from "../components/find/context";
import { hitFields, jsonHits, listHits, openPaths, tableHits, type FindHit } from "../lib/find";
import type { DocumentView } from "../store/view";
import type { LoadedDocument } from "../types";

export const FIND_HOTKEY = "mod+f";

/** Frames to wait for a virtualized row to render before scrolling to its hit. */
const SCROLL_ATTEMPTS = 3;

const HITS: Record<DocumentView, (documents: LoadedDocument[], needle: string) => FindHit[]> = {
  list: listHits,
  json: jsonHits,
  table: tableHits,
};

/** Scrolls the current hit into view once its view has rendered it. */
function scrollToCurrent(attempt = 1): void {
  requestAnimationFrame(() => {
    const mark = document.querySelector("[data-find-current]");
    if (mark) mark.scrollIntoView({ block: "nearest", inline: "nearest" });
    else if (attempt < SCROLL_ATTEMPTS) scrollToCurrent(attempt + 1);
  });
}

/** `documents` must keep its identity while the page does not change. */
export function useDocumentFind(view: DocumentView, documents: LoadedDocument[]) {
  const [open, setOpen] = useState(false);
  const [needle, setNeedleState] = useState("");
  const [index, setIndex] = useState(0);
  const [page, setPage] = useState(documents);
  const inputRef = useRef<HTMLInputElement>(null);
  // A new page (or reload) starts at its first hit.
  if (page !== documents) {
    setPage(documents);
    setIndex(0);
  }

  const active = open ? needle : "";
  const hits = useMemo(
    () => (active ? HITS[view](documents, active) : []),
    [view, documents, active],
  );
  const position = hits.length === 0 ? 0 : Math.min(index, hits.length - 1);
  const current = hits[position];
  const currentId = current?.id ?? null;

  useEffect(() => {
    if (currentId) scrollToCurrent();
  }, [currentId]);

  /** Opens the bar (or keeps it open) with its text selected. */
  const show = () => {
    setOpen(true);
    requestAnimationFrame(() => {
      inputRef.current?.focus();
      inputRef.current?.select();
    });
  };
  useHotkey(FIND_HOTKEY, () => {
    if (!isDialogOpen()) show();
  });

  const state = useMemo<FindState>(
    () => ({
      needle: active,
      current: currentId,
      currentDocument: current?.document ?? null,
      open: openPaths(hits),
      fields: hitFields(hits),
    }),
    [active, currentId, current, hits],
  );

  const step = (offset: number) => {
    if (hits.length === 0) return;
    setIndex((position + offset + hits.length) % hits.length);
  };

  return {
    open,
    show,
    close: () => {
      setOpen(false);
    },
    needle,
    setNeedle: (value: string) => {
      setNeedleState(value);
      setIndex(0);
    },
    count: hits.length,
    position,
    next: () => {
      step(1);
    },
    previous: () => {
      step(-1);
    },
    state,
    inputRef,
  };
}
