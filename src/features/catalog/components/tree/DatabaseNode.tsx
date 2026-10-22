import { useQueryClient } from "@tanstack/react-query";
import { ChevronRightIcon, DatabaseIcon, PlusIcon, RefreshCwIcon, Trash2Icon } from "lucide-react";
import { useId } from "react";

import { cn } from "@/shared/lib/cn";
import { formatBytes } from "@/shared/lib/format";
import { DropdownMenuItem, DropdownMenuSeparator } from "@/shared/ui/dropdown-menu";

import { catalogKeys } from "../../api/keys";
import { useCollections } from "../../api/queries";
import { useCatalogDialogs } from "../../store/dialogs";
import { useExpandedDatabases, useIsDatabaseExpanded } from "../../store/expanded";
import type { DatabaseInfo } from "../../types";
import { CollectionNode } from "./CollectionNode";
import { DEPTH_PADDING } from "./depth";
import { RowMenu } from "./RowMenu";
import { TreeStatus } from "./TreeStatus";

/** Above this many collections, document counts are not fetched for every row. */
const COUNT_COLLECTIONS_LIMIT = 100;

interface DatabaseNodeProps {
  connectionId: string;
  info: DatabaseInfo;
}

/** A database row; expanding it lists its collections and views. */
export function DatabaseNode({ connectionId, info }: DatabaseNodeProps) {
  const { name } = info;
  const expanded = useIsDatabaseExpanded(connectionId, name);
  const toggle = useExpandedDatabases((state) => state.toggle);
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
          className={cn(
            "flex min-w-0 flex-1 items-center gap-1.5 rounded-sm py-1 pr-1 text-left text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring",
            DEPTH_PADDING[1],
          )}
          onClick={() => {
            toggle(connectionId, name);
          }}
        >
          <ChevronRightIcon
            className={cn("size-3.5 shrink-0 transition-transform", expanded && "rotate-90")}
            aria-hidden
          />
          <DatabaseIcon className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
          <span className="truncate">{name}</span>
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
      {expanded && <CollectionList id={listId} connectionId={connectionId} database={name} />}
    </li>
  );
}

interface CollectionListProps {
  id: string;
  connectionId: string;
  database: string;
}

function CollectionList({ id, connectionId, database }: CollectionListProps) {
  const { data, error, isPending, refetch } = useCollections(connectionId, database);
  const showCount = (data?.length ?? 0) <= COUNT_COLLECTIONS_LIMIT;

  return (
    <div id={id}>
      <TreeStatus
        depth={2}
        pending={isPending}
        error={error}
        loadingLabel="Loading collections…"
        onRetry={() => void refetch()}
      />
      {data?.length === 0 && (
        <p className={cn("py-1 text-xs text-muted-foreground", DEPTH_PADDING[2])}>No collections</p>
      )}
      {data && data.length > 0 && (
        <ul aria-label={`Collections in ${database}`} className="flex flex-col gap-px">
          {data.map((collection) => (
            <CollectionNode
              key={collection.name}
              connectionId={connectionId}
              database={database}
              info={collection}
              showCount={showCount}
            />
          ))}
        </ul>
      )}
    </div>
  );
}
