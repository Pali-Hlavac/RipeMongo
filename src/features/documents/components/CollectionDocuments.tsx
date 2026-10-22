import { useQueryClient } from "@tanstack/react-query";
import { FileSearchIcon } from "lucide-react";
import { useMemo } from "react";

import { EmptyState } from "@/shared/components/EmptyState";
import { ErrorState } from "@/shared/components/ErrorState";
import { LoadingState } from "@/shared/components/LoadingState";
import { toIpcError } from "@/shared/ipc/client";
import { cn } from "@/shared/lib/cn";

import { documentKeys, type CollectionTarget } from "../api/keys";
import { useDocumentCount, useDocumentPage } from "../api/queries";
import { useRecordSuccessfulQuery } from "../hooks/useRecordSuccessfulQuery";
import { fieldPaths } from "../lib/fields";
import { pageHasMore, pageWindow, visibleCount } from "../lib/query";
import { useCollectionView, type DocumentView } from "../store/view";
import type { FindRequest, LoadedDocument } from "../types";
import { DocumentsToolbar } from "./DocumentsToolbar";
import { JsonView } from "./JsonView";
import { DocumentListView } from "./list/DocumentListView";
import { QueryBar } from "./query/QueryBar";
import { TableView } from "./TableView";

interface CollectionDocumentsProps extends CollectionTarget {
  /** Workspace tab id; view settings and the query are kept per tab. */
  tabId: string;
}

/** Documents of a collection: query bar, view switcher, paging and the selected view. */
export function CollectionDocuments({ tabId, ...target }: CollectionDocumentsProps) {
  const queryClient = useQueryClient();
  const [state, update] = useCollectionView(tabId);
  const { query } = state;
  const request: FindRequest = {
    filter: query.filter,
    projection: query.projection,
    sort: query.sort,
    collation: query.collation,
    ...pageWindow(query, state.skip, state.pageSize),
    maxTimeMs: query.maxTimeMs > 0 ? query.maxTimeMs : null,
  };
  const page = useDocumentPage(target, request);
  const count = useDocumentCount(target, query.filter);
  const documents = page.data?.documents ?? [];
  const reload = () => {
    void queryClient.invalidateQueries({ queryKey: documentKeys.collection(target) });
  };
  const fields = useMemo(() => fieldPaths(page.data?.documents ?? []), [page.data]);
  // Placeholder data is the previous query's page, so it does not count as success yet.
  useRecordSuccessfulQuery(target, query, page.isSuccess && !page.isPlaceholderData);
  // A rejected query (syntax, bad option) is explained in the query bar, next to the input.
  const queryError =
    page.error && toIpcError(page.error).code === "INVALID_INPUT" ? page.error : null;

  return (
    <section aria-label="Documents" className="flex min-h-0 flex-1 flex-col">
      <QueryBar
        target={target}
        applied={query}
        fields={fields}
        error={queryError}
        onApply={(next) => {
          const unchanged = JSON.stringify(next) === JSON.stringify(query) && state.skip === 0;
          update({ query: next, skip: 0 });
          // Find always runs, even when the query did not change.
          if (unchanged) reload();
        }}
      />
      <DocumentsToolbar
        state={state}
        onChange={update}
        onReload={reload}
        reloading={page.isFetching}
        shown={documents.length}
        hasMore={pageHasMore(query, state.skip, documents.length, page.data?.hasMore ?? false)}
        count={visibleCount(query, count.data)}
      />
      <div
        className={cn(
          "min-h-0 flex-1",
          state.view === "table" ? "overflow-hidden" : "overflow-auto",
        )}
        aria-busy={page.isFetching}
      >
        {page.isPending && <LoadingState label="Loading documents…" />}
        {page.error && !queryError && (
          <ErrorState
            error={page.error}
            title="Could not load documents"
            onRetry={() => void page.refetch()}
          />
        )}
        {page.data &&
          !page.error &&
          (documents.length === 0 ? (
            <NoDocuments filtered={query.filter.trim() !== ""} pastEnd={state.skip > 0} />
          ) : (
            <DocumentsBody view={state.view} documents={documents} firstRow={state.skip + 1} />
          ))}
      </div>
    </section>
  );
}

function NoDocuments({ filtered, pastEnd }: { filtered: boolean; pastEnd: boolean }) {
  const [title, description] = pastEnd
    ? ["No more documents", "This page is past the last document."]
    : filtered
      ? ["No matching documents", "No document matches this filter."]
      : ["No documents", "This collection is empty."];
  return (
    <EmptyState icon={FileSearchIcon} title={title} description={description} className="h-full" />
  );
}

interface BodyProps {
  view: DocumentView;
  documents: LoadedDocument[];
  firstRow: number;
}

function DocumentsBody({ view, documents, firstRow }: BodyProps) {
  switch (view) {
    case "list":
      return <DocumentListView documents={documents} />;
    case "json":
      return <JsonView documents={documents} />;
    case "table":
      return <TableView documents={documents} firstRow={firstRow} />;
  }
}
