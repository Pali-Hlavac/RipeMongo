import { useQueryClient } from "@tanstack/react-query";
import {
  ArchiveIcon,
  ChevronRightIcon,
  CopyIcon,
  DatabaseIcon,
  PlusIcon,
  RefreshCwIcon,
  Trash2Icon,
  UploadIcon,
} from "lucide-react";
import { useId } from "react";

import { useCopyDialog, useDumpDialog, useImportDialog } from "@/features/tools";
import { Highlight } from "@/shared/components/Highlight";
import { cn } from "@/shared/lib/cn";
import { formatBytes } from "@/shared/lib/format";
import { DropdownMenuItem, DropdownMenuSeparator } from "@/shared/ui/dropdown-menu";

import { catalogKeys } from "../../api/keys";
import type { TreeFilter } from "../../lib/filter";
import { useCatalogDialogs } from "../../store/dialogs";
import { databaseKey, useExpandedDatabases, useIsDatabaseExpanded } from "../../store/expanded";
import { useFilterExpanded, useFilterExpandedStore } from "../../store/filter-expanded";
import type { DatabaseInfo } from "../../types";
import { CollectionList } from "./CollectionList";
import { DEPTH_PADDING } from "./depth";
import { RowMenu } from "./RowMenu";

interface DatabaseNodeProps {
  connectionId: string;
  info: DatabaseInfo;
  /** Set while the sidebar filter is active and this database matched. */
  filter?: TreeFilter;
}

/** A database row; expanding it lists its collections and views. */
export function DatabaseNode({ connectionId, info, filter }: DatabaseNodeProps) {
  const { name } = info;
  const key = databaseKey(connectionId, name);
  const match = filter?.search.databases.get(name);
  const stored = useIsDatabaseExpanded(connectionId, name);
  const byFilter = useFilterExpanded(key, filter?.text ?? "", stored || (match?.expand ?? false));
  const expanded = filter ? byFilter : stored;
  const toggle = () => {
    if (filter) useFilterExpandedStore.getState().setExpanded(filter.text, key, !expanded);
    else useExpandedDatabases.getState().toggle(connectionId, name);
  };
  const open = useCatalogDialogs((state) => state.open);
  const queryClient = useQueryClient();
  const listId = useId();

  return (
    <li>
      <div className="group flex items-center gap-1 rounded-sm pr-1 hover:bg-accent">
        <button
          type="button"
          aria-expanded={expanded}
          aria-controls={expanded ? listId : undefined}
          data-sidebar-row=""
          data-sidebar-match={match?.ranges.length ? "database" : undefined}
          className={cn(
            "flex min-w-0 flex-1 items-center gap-1.5 rounded-sm py-1 pr-1 text-left text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring",
            DEPTH_PADDING[1],
          )}
          onClick={toggle}
        >
          <ChevronRightIcon
            className={cn("size-3.5 shrink-0 transition-transform", expanded && "rotate-90")}
            aria-hidden
          />
          <DatabaseIcon className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
          <span className="truncate">
            <Highlight text={name} ranges={match?.ranges} />
          </span>
          {info.sizeOnDisk != null && info.sizeOnDisk > 0 && (
            <span className="ml-auto shrink-0 text-xs text-muted-foreground tabular-nums">
              {formatBytes(info.sizeOnDisk)}
            </span>
          )}
        </button>
        <RowMenu label={`Actions for database ${name}`}>
          <DropdownMenuItem
            onSelect={() => {
              open({ type: "createCollection", connectionId, database: name });
            }}
          >
            <PlusIcon aria-hidden /> Create collection…
          </DropdownMenuItem>
          <DropdownMenuItem
            onSelect={() => {
              useDumpDialog.getState().open({ connectionId, database: name, collection: null });
            }}
          >
            <ArchiveIcon aria-hidden /> Dump database…
          </DropdownMenuItem>
          <DropdownMenuItem
            onSelect={() => {
              useImportDialog.getState().open({ connectionId, database: name, collection: null });
            }}
          >
            <UploadIcon aria-hidden /> Import into a new collection…
          </DropdownMenuItem>
          <DropdownMenuItem
            onSelect={() => {
              useCopyDialog.getState().open({ connectionId, database: name, collection: null });
            }}
          >
            <CopyIcon aria-hidden /> Copy database…
          </DropdownMenuItem>
          <DropdownMenuItem
            onSelect={() => {
              void queryClient.invalidateQueries({
                queryKey: catalogKeys.database(connectionId, name),
              });
            }}
          >
            <RefreshCwIcon aria-hidden /> Refresh
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            destructive
            onSelect={() => {
              open({ type: "dropDatabase", connectionId, database: name });
            }}
          >
            <Trash2Icon aria-hidden /> Drop database…
          </DropdownMenuItem>
        </RowMenu>
      </div>
      {expanded && (
        <CollectionList
          id={listId}
          connectionId={connectionId}
          database={name}
          match={match?.showAll === false ? match.collections : undefined}
        />
      )}
    </li>
  );
}
