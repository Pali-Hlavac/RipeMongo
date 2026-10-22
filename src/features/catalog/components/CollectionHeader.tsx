import { useQueryClient } from "@tanstack/react-query";
import { RefreshCwIcon } from "lucide-react";

import { formatBytes, formatCount } from "@/shared/lib/format";
import { Button } from "@/shared/ui/button";
import { Tooltip } from "@/shared/ui/tooltip";

import { catalogKeys } from "../api/keys";
import { useCollections, useCollectionStats } from "../api/queries";
import type { CollectionInfo, CollectionStats } from "../types";

const KIND_BADGES: Record<CollectionInfo["kind"], string> = {
  collection: "Collection",
  view: "View",
  timeseries: "Time series",
};

interface CollectionHeaderProps {
  connectionId: string;
  database: string;
  collection: string;
}

/** Title bar of a collection tab: namespace, kind and storage statistics. */
export function CollectionHeader({ connectionId, database, collection }: CollectionHeaderProps) {
  const queryClient = useQueryClient();
  const { data: collections } = useCollections(connectionId, database);
  const info = collections?.find((candidate) => candidate.name === collection);
  const isView = info?.kind === "view";
  // Wait for the kind so views never request statistics they cannot have.
  const stats = useCollectionStats(
    connectionId,
    database,
    collection,
    info !== undefined && !isView,
  );

  return (
    <header className="flex flex-wrap items-center gap-x-4 gap-y-1 border-b border-border px-4 py-2">
      <div className="flex min-w-0 items-baseline gap-2">
        <h1 className="truncate text-base font-semibold">
          <span className="font-normal text-muted-foreground">{database}.</span>
          {collection}
        </h1>
        {info && (
          <span className="shrink-0 rounded-sm bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
            {KIND_BADGES[info.kind]}
            {info.capped && " · capped"}
            {info.readOnly && " · read-only"}
          </span>
        )}
      </div>
      {isView && info.viewOn && (
        <p className="text-sm text-muted-foreground">
          View on <span className="font-mono">{info.viewOn}</span>
        </p>
      )}
      {stats.data && <StatsSummary stats={stats.data} />}
      <Tooltip content="Refresh statistics">
        <Button
          variant="ghost"
          size="icon"
          className="ml-auto size-7"
          aria-label="Refresh statistics"
          onClick={() => {
            void queryClient.invalidateQueries({
              queryKey: catalogKeys.database(connectionId, database),
            });
          }}
        >
          <RefreshCwIcon aria-hidden />
        </Button>
      </Tooltip>
    </header>
  );
}

function StatsSummary({ stats }: { stats: CollectionStats }) {
  const items: [string, string | null][] = [
    ["Documents", stats.documentCount == null ? null : formatCount(stats.documentCount)],
    ["Data size", stats.size == null ? null : formatBytes(stats.size)],
    [
      "Avg. document",
      stats.averageDocumentSize == null ? null : formatBytes(stats.averageDocumentSize),
    ],
    ["Storage", stats.storageSize == null ? null : formatBytes(stats.storageSize)],
    ["Indexes", stats.indexSize == null ? null : formatBytes(stats.indexSize)],
  ];
  return (
    <dl className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
      {items.map(([label, value]) =>
        value === null ? null : (
          <div key={label} className="flex gap-1.5">
            <dt className="text-muted-foreground">{label}</dt>
            <dd className="tabular-nums">{value}</dd>
          </div>
        ),
      )}
    </dl>
  );
}
