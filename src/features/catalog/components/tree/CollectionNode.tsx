import {
  ArchiveIcon,
  CopyIcon,
  DownloadIcon,
  UploadIcon,
  ClockIcon,
  EyeIcon,
  FilePlus2Icon,
  PencilIcon,
  Table2Icon,
  Trash2Icon,
  type LucideIcon,
} from "lucide-react";

import { useCopyDialog, useDumpDialog, useExportDialog, useImportDialog } from "@/features/tools";
import { useTabsStore } from "@/features/workspace";
import { cn } from "@/shared/lib/cn";
import { formatCompactCount, formatCount } from "@/shared/lib/format";
import { DropdownMenuItem, DropdownMenuSeparator } from "@/shared/ui/dropdown-menu";

import { useCollectionStats } from "../../api/queries";
import { collectionTabId, openCollectionTab } from "../../lib/tabs";
import { useCatalogDialogs } from "../../store/dialogs";
import type { CollectionInfo, CollectionKind } from "../../types";
import { DEPTH_PADDING } from "./depth";
import { RowMenu } from "./RowMenu";

const KIND_ICONS: Record<CollectionKind, LucideIcon> = {
  collection: Table2Icon,
  view: EyeIcon,
  timeseries: ClockIcon,
};

/** Spoken after the name of non-standard kinds, which only an icon shows visually. */
const KIND_LABELS: Record<CollectionKind, string> = {
  collection: "collection",
  view: "view",
  timeseries: "time series",
};

interface CollectionNodeProps {
  connectionId: string;
  database: string;
  info: CollectionInfo;
  /** Fetch the document count; off for very large databases to avoid a request storm. */
  showCount: boolean;
}

/** A collection or view; click opens its tab. */
export function CollectionNode({ connectionId, database, info, showCount }: CollectionNodeProps) {
  const { name, kind } = info;
  const active = useTabsStore(
    (state) => state.activeTabId === collectionTabId(connectionId, database, name),
  );
  // Only regular collections report a meaningful count; views have no storage.
  const stats = useCollectionStats(
    connectionId,
    database,
    name,
    showCount && kind === "collection",
  );
  const count = stats.data?.documentCount;
  const open = useCatalogDialogs((state) => state.open);
  const Icon = KIND_ICONS[kind];
  const target = { connectionId, database, collection: name };

  return (
    <li>
      <div
        className={cn(
          "group flex items-center gap-1 rounded-sm pr-1 hover:bg-accent",
          active && "bg-accent",
        )}
      >
        <button
          type="button"
          aria-current={active ? "page" : undefined}
          title={`${database}.${name}`}
          className={cn(
            "flex min-w-0 flex-1 items-center gap-2 rounded-sm py-1 pr-1 text-left text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring",
            DEPTH_PADDING[2],
          )}
          onClick={() => {
            openCollectionTab(connectionId, database, name);
          }}
        >
          <Icon className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
          <span className="truncate">{name}</span>
          {kind !== "collection" && <span className="sr-only">({KIND_LABELS[kind]})</span>}
          {count != null && (
            <span
              className="ml-auto shrink-0 text-xs text-muted-foreground tabular-nums"
              title={`${formatCount(count)} documents`}
            >
              {formatCompactCount(count)}
            </span>
          )}
        </button>
        <RowMenu label={`Actions for ${name}`}>
          {kind !== "view" && (
            <DropdownMenuItem
              onSelect={() => {
                open({ type: "createCollection", connectionId, database, viewOn: name });
              }}
            >
              <FilePlus2Icon aria-hidden /> Create view…
            </DropdownMenuItem>
          )}
          {kind === "collection" && (
            <DropdownMenuItem
              onSelect={() => {
                open({ type: "renameCollection", ...target });
              }}
            >
              <PencilIcon aria-hidden /> Rename…
            </DropdownMenuItem>
          )}
          {kind !== "view" && (
            <DropdownMenuItem
              onSelect={() => {
                useDumpDialog.getState().open({ connectionId, database, collection: name });
              }}
            >
              <ArchiveIcon aria-hidden /> Dump collection…
            </DropdownMenuItem>
          )}
          <DropdownMenuItem
            onSelect={() => {
              useExportDialog.getState().open(target);
            }}
          >
            <DownloadIcon aria-hidden /> Export to JSON or CSV…
          </DropdownMenuItem>
          {kind !== "view" && (
            <DropdownMenuItem
              onSelect={() => {
                useImportDialog.getState().open(target);
              }}
            >
              <UploadIcon aria-hidden /> Import from JSON or CSV…
            </DropdownMenuItem>
          )}
          {kind !== "view" && (
            <DropdownMenuItem
              onSelect={() => {
                useCopyDialog.getState().open({ connectionId, database, collection: name });
              }}
            >
              <CopyIcon aria-hidden /> Copy collection…
            </DropdownMenuItem>
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem
            destructive
            onSelect={() => {
              open({ type: "dropCollection", ...target, kind });
            }}
          >
            <Trash2Icon aria-hidden /> {kind === "view" ? "Drop view…" : "Drop collection…"}
          </DropdownMenuItem>
        </RowMenu>
      </div>
    </li>
  );
}
