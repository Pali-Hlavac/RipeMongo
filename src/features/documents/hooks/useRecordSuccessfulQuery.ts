import { useEffect, useRef } from "react";

import { useRecordQuery } from "../api/history";
import type { CollectionTarget } from "../api/keys";
import { queryParts } from "../lib/query";
import type { QueryParts } from "../types";

/**
 * Adds the applied query to the collection's history once it has loaded successfully.
 * Paging through results of the same query does not record it again.
 */
export function useRecordSuccessfulQuery(
  target: CollectionTarget,
  query: QueryParts,
  succeeded: boolean,
): void {
  const record = useRecordQuery(target);
  const lastRecorded = useRef<string | null>(null);
  const parts = queryParts(query);
  const key = JSON.stringify(parts);

  useEffect(() => {
    if (!succeeded || lastRecorded.current === key) return;
    lastRecorded.current = key;
    record.mutate(JSON.parse(key) as QueryParts);
    // `record` changes identity every render; the key alone decides when to record.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [succeeded, key]);
}
