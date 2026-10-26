import { DownloadIcon, PlusIcon, RefreshCwIcon, UploadIcon } from "lucide-react";

import { useExportDialog, useImportDialog } from "@/features/tools";

import { cn } from "@/shared/lib/cn";
import { Button } from "@/shared/ui/button";
import { Tooltip } from "@/shared/ui/tooltip";

import type { CollectionTarget } from "../api/keys";
import type { CollectionViewState, DocumentView } from "../store/view";
import type { DocumentCount } from "../types";
import { useDocumentActions } from "./actions/context";
import { BulkActionsMenu } from "./bulk/BulkActionsMenu";
import { Pager } from "./Pager";
import { ViewSwitcher } from "./ViewSwitcher";

interface DocumentsToolbarProps {
  target: CollectionTarget;
  /** Applied filter of the tab, for the bulk actions. */
  filter: string;
  state: CollectionViewState;
  onChange: (patch: Partial<CollectionViewState>) => void;
  onReload: () => void;
  reloading: boolean;
  shown: number;
  hasMore: boolean;
  count: DocumentCount | undefined;
  ready: boolean;
}

/** View switcher, reload and pager above the documents. */
export function DocumentsToolbar({
  target,
  filter,
  state,
  onChange,
  onReload,
  reloading,
  shown,
  hasMore,
  count,
  ready,
}: DocumentsToolbarProps) {
  const actions = useDocumentActions();
  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-border px-4 py-1.5">
      <ViewSwitcher
        value={state.view}
        onChange={(view: DocumentView) => {
          onChange({ view });
        }}
      />
      <Tooltip content="Reload documents">
        <Button
          variant="ghost"
          size="icon"
          className="size-7"
          aria-label="Reload documents"
          onClick={onReload}
        >
          <RefreshCwIcon aria-hidden className={cn(reloading && "animate-spin")} />
        </Button>
      </Tooltip>
      {!actions.readOnly && (
        <>
          <Button variant="outline" size="sm" className="h-7" onClick={actions.insert}>
            <PlusIcon aria-hidden /> Insert
          </Button>
          <Tooltip content="Import documents from a JSON or CSV file">
            <Button
              variant="outline"
              size="sm"
              className="h-7"
              onClick={() => {
                useImportDialog.getState().open(target);
              }}
            >
              <UploadIcon aria-hidden /> Import
            </Button>
          </Tooltip>
          <BulkActionsMenu target={target} filter={filter} />
        </>
      )}
      <Tooltip content="Export the documents matching the applied query to JSON or CSV">
        <Button
          variant="outline"
          size="sm"
          className="h-7"
          onClick={() => {
            const { filter, sort, skip, limit, projection } = state.query;
            useExportDialog
              .getState()
              .open({ ...target, query: { filter, sort, skip, limit, projection } });
          }}
        >
          <DownloadIcon aria-hidden /> Export
        </Button>
      </Tooltip>
      <div className="ml-auto">
        <Pager
          skip={state.skip}
          pageSize={state.pageSize}
          shown={shown}
          hasMore={hasMore}
          count={count}
          ready={ready}
          onChange={onChange}
        />
      </div>
    </div>
  );
}
