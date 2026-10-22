import { cn } from "@/shared/lib/cn";

import { useDatabases } from "../../api/queries";
import { DatabaseNode } from "./DatabaseNode";
import { DEPTH_PADDING } from "./depth";
import { TreeStatus } from "./TreeStatus";

interface DatabaseTreeProps {
  connectionId: string;
  /** Id of the tree, referenced by the connection row's `aria-controls`. */
  id?: string;
  /** Accessible name, usually "Databases in <connection>". */
  label: string;
}

/** Databases → collections of one connected server. Render only while connected. */
export function DatabaseTree({ connectionId, id, label }: DatabaseTreeProps) {
  const { data, error, isPending, refetch } = useDatabases(connectionId);

  return (
    <div id={id}>
      <TreeStatus
        depth={1}
        pending={isPending}
        error={error}
        loadingLabel="Loading databases…"
        onRetry={() => void refetch()}
      />
      {data?.length === 0 && (
        <p className={cn("py-1 text-xs text-muted-foreground", DEPTH_PADDING[1])}>
          No databases you can access
        </p>
      )}
      {data && data.length > 0 && (
        <ul aria-label={label} className="flex flex-col gap-px">
          {data.map((database) => (
            <DatabaseNode key={database.name} connectionId={connectionId} info={database} />
          ))}
        </ul>
      )}
    </div>
  );
}
