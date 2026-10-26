import type { MatchRange } from "@/shared/lib/fuzzy";
import { cn } from "@/shared/lib/cn";

import { useCollections } from "../../api/queries";
import { CollectionNode } from "./CollectionNode";
import { DEPTH_PADDING } from "./depth";
import { TreeStatus } from "./TreeStatus";

/** Above this many collections, document counts are not fetched for every row. */
const COUNT_COLLECTIONS_LIMIT = 100;

interface CollectionListProps {
  id: string;
  connectionId: string;
  database: string;
  /** Only these collections, with the characters to highlight (sidebar filter). */
  match?: Map<string, MatchRange[]>;
}

/** The collections and views of an expanded database. */
export function CollectionList({ id, connectionId, database, match }: CollectionListProps) {
  const { data, error, isPending, refetch } = useCollections(connectionId, database);
  const shown = match ? data?.filter((collection) => match.has(collection.name)) : data;
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
      {shown && shown.length > 0 && (
        <ul aria-label={`Collections in ${database}`} className="flex flex-col gap-px">
          {shown.map((collection) => (
            <CollectionNode
              key={collection.name}
              connectionId={connectionId}
              database={database}
              info={collection}
              showCount={showCount}
              match={match?.get(collection.name)}
            />
          ))}
        </ul>
      )}
    </div>
  );
}
