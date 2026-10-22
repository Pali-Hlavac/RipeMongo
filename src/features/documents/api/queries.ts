/** Paged document queries and counts. */
import { keepPreviousData, useQuery } from "@tanstack/react-query";

import { commands, unwrap } from "@/shared/ipc/client";

import { getField, parseDocument } from "../lib/bson";
import { previewText } from "../lib/format";
import type { DocumentPage, FindRequest } from "../types";
import { documentKeys, type CollectionTarget } from "./keys";

/** Counting a huge collection with a filter can be slow; give up after this long. */
export const COUNT_MAX_TIME_MS = 10_000;

async function loadPage(target: CollectionTarget, request: FindRequest): Promise<DocumentPage> {
  const { connectionId, database, collection } = target;
  const page = await unwrap(commands.findDocuments(connectionId, database, collection, request));
  return {
    hasMore: page.hasMore,
    documents: page.documents.map((json, index) => {
      const value = parseDocument(json);
      const id = getField(value, "_id");
      return { key: `${index}:${id ? previewText(id) : ""}`, json, value };
    }),
  };
}

/** One page; while the next page loads, the previous one stays on screen. */
export function useDocumentPage(target: CollectionTarget, request: FindRequest) {
  return useQuery({
    queryKey: documentKeys.page(target, request),
    queryFn: () => loadPage(target, request),
    placeholderData: keepPreviousData,
  });
}

/** Total matching documents, for "1–20 of 1,500". */
export function useDocumentCount(target: CollectionTarget, filter: string) {
  const { connectionId, database, collection } = target;
  return useQuery({
    queryKey: documentKeys.count(target, filter),
    queryFn: () =>
      unwrap(
        commands.countDocuments(connectionId, database, collection, filter, COUNT_MAX_TIME_MS),
      ),
  });
}
