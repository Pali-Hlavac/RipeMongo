import { DatabaseIcon } from "lucide-react";

import { EmptyState } from "@/shared/components/EmptyState";

/** Left navigation. The connection tree lands here in milestone 2. */
export function Sidebar() {
  return (
    <nav aria-label="Connections" className="flex h-full flex-col bg-muted/40">
      <h2 className="flex h-9 shrink-0 items-center border-b border-border px-3 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
        Connections
      </h2>
      <EmptyState
        icon={DatabaseIcon}
        title="No connections yet"
        description="Connection management is not implemented yet. It is planned for milestone 2."
        className="flex-1"
      />
    </nav>
  );
}
