import { LoaderCircleIcon } from "lucide-react";

import { cn } from "@/shared/lib/cn";
import { formatCount } from "@/shared/lib/format";

import { useDatabases } from "../../api/queries";
import type { TreeFilter } from "../../lib/filter";
import { DatabaseNode } from "./DatabaseNode";
import { DEPTH_PADDING } from "./depth";
import { TreeStatus } from "./TreeStatus";

interface DatabaseTreeProps {
  connectionId: string;
  /** Id of the tree, referenced by the connection row's `aria-controls`. */
  id?: string;
  /** Accessible name, usually "Databases in <connection>". */
  label: string;
  /** Only matching databases and collections, while the sidebar filter is active. */
  filter?: TreeFilter;
}

/** Databases → collections of one connected server. Render only while connected. */
export function DatabaseTree({ connectionId, id, label, filter }: DatabaseTreeProps) {
  const { data, error, isPending, refetch } = useDatabases(connectionId);
  const matches = filter?.search.databases;
  const shown = matches ? data?.filter((database) => matches.has(database.name)) : data;
  const hint = cn(
    "flex items-center gap-1.5 py-1 pr-2 text-xs text-muted-foreground",
    DEPTH_PADDING[1],
  );

  return (
    <div id={id}>
      <TreeStatus
        depth={1}
        pending={isPending}
        error={error}
        loadingLabel="Loading databases…"
        onRetry={() => void refetch()}
      />
      {data?.length === 0 && <p className={hint}>No databases you can access</p>}
      {shown && shown.length > 0 && (
        <ul aria-label={label} className="flex flex-col gap-px">
          {shown.map((database) => (
            <DatabaseNode
              key={database.name}
              connectionId={connectionId}
              info={database}
              filter={filter}
            />
          ))}
        </ul>
      )}
      {filter?.search.searching && (
        <p role="status" className={hint}>
          <LoaderCircleIcon className="size-3.5 animate-spin" aria-hidden />
          Searching…
        </p>
      )}
      {filter && filter.search.notSearched > 0 && (
        <p className={hint}>
          {formatCount(filter.search.notSearched)} more{" "}
          {filter.search.notSearched === 1 ? "database was" : "databases were"} not searched. Type
          database.collection to narrow the search.
        </p>
      )}
    </div>
  );
}
