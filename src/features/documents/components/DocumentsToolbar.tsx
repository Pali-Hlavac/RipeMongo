import { RefreshCwIcon } from "lucide-react";

import { cn } from "@/shared/lib/cn";
import { Button } from "@/shared/ui/button";
import { Tooltip } from "@/shared/ui/tooltip";

import type { CollectionViewState, DocumentView } from "../store/view";
import type { DocumentCount } from "../types";
import { Pager } from "./Pager";
import { ViewSwitcher } from "./ViewSwitcher";

interface DocumentsToolbarProps {
  state: CollectionViewState;
  onChange: (patch: Partial<CollectionViewState>) => void;
  onReload: () => void;
  reloading: boolean;
  shown: number;
  hasMore: boolean;
  count: DocumentCount | undefined;
}

/** View switcher, reload and pager above the documents. */
export function DocumentsToolbar({
  state,
  onChange,
  onReload,
  reloading,
  shown,
  hasMore,
  count,
}: DocumentsToolbarProps) {
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
      <div className="ml-auto">
        <Pager
          skip={state.skip}
          pageSize={state.pageSize}
          shown={shown}
          hasMore={hasMore}
          count={count}
          onChange={onChange}
        />
      </div>
    </div>
  );
}
