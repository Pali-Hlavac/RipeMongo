import { useQueryClient } from "@tanstack/react-query";
import { FileSearchIcon, RefreshCwIcon } from "lucide-react";

import { EmptyState } from "@/shared/components/EmptyState";
import { ErrorState } from "@/shared/components/ErrorState";
import { LoadingState } from "@/shared/components/LoadingState";
import { cn } from "@/shared/lib/cn";
import { Button } from "@/shared/ui/button";
import { Tooltip } from "@/shared/ui/tooltip";

import { documentKeys, type CollectionTarget } from "../api/keys";
import { useDocumentCount, useDocumentPage } from "../api/queries";
import { useCollectionView } from "../store/view";
import type { FindRequest, LoadedDocument } from "../types";
import { JsonView } from "./JsonView";
import { DocumentListView } from "./list/DocumentListView";
import { Pager } from "./Pager";
import { TableView } from "./TableView";
import { ViewSwitcher } from "./ViewSwitcher";

/** Server-side limit for loading a page, so a slow query never hangs the tab. */
export const FIND_MAX_TIME_MS = 60_000;

interface CollectionDocumentsProps extends CollectionTarget {
  /** Workspace tab id; view settings are kept per tab. */
  tabId: string;
}

/** Documents of a collection: view switcher, paging and the selected view. */
export function CollectionDocuments({ tabId, ...target }: CollectionDocumentsProps) {
  const queryClient = useQueryClient();
  const [state, update] = useCollectionView(tabId);
  const request: FindRequest = {
    filter: "",
    projection: "",
    sort: "",
    collation: "",
    skip: state.skip,
    limit: state.pageSize,
    maxTimeMs: FIND_MAX_TIME_MS,
  };
  const page = useDocumentPage(target, request);
  const count = useDocumentCount(target, request.filter);
  const documents = page.data?.documents ?? [];

  return (
    <section aria-label="Documents" className="flex min-h-0 flex-1 flex-col">
      <div className="flex flex-wrap items-center gap-2 border-b border-border px-4 py-1.5">
        <ViewSwitcher
          value={state.view}
          onChange={(view) => {
            update({ view });
          }}
        />
        <Tooltip content="Reload documents">
          <Button
            variant="ghost"
            size="icon"
            className="size-7"
            aria-label="Reload documents"
            onClick={() =>
              void queryClient.invalidateQueries({ queryKey: documentKeys.collection(target) })
            }
          >
            <RefreshCwIcon aria-hidden className={cn(page.isFetching && "animate-spin")} />
          </Button>
        </Tooltip>
        <div className="ml-auto">
          <Pager
            skip={state.skip}
            pageSize={state.pageSize}
            shown={documents.length}
            hasMore={page.data?.hasMore ?? false}
            count={count.data}
            onChange={update}
          />
        </div>
      </div>
      <div
        className={cn(
          "min-h-0 flex-1",
          state.view === "table" ? "overflow-hidden" : "overflow-auto",
        )}
        aria-busy={page.isFetching}
      >
        {page.isPending && <LoadingState label="Loading documents…" />}
        {page.error && (
          <ErrorState
            error={page.error}
            title="Could not load documents"
            onRetry={() => void page.refetch()}
          />
        )}
        {page.data &&
          (documents.length === 0 ? (
            <EmptyState
              icon={FileSearchIcon}
              title={state.skip > 0 ? "No more documents" : "No documents"}
              description={
                state.skip > 0
                  ? "This page is past the last document."
                  : "This collection is empty."
              }
              className="h-full"
            />
          ) : (
            <DocumentsBody view={state.view} documents={documents} firstRow={state.skip + 1} />
          ))}
      </div>
    </section>
  );
}

interface BodyProps {
  view: "list" | "json" | "table";
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
