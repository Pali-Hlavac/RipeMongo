import { FileJsonIcon } from "lucide-react";

import { CollectionHeader } from "@/features/catalog";
import type { CollectionTab } from "@/features/workspace";
import { EmptyState } from "@/shared/components/EmptyState";

/** A collection tab: header with statistics; documents arrive with the next M3 slice. */
export function CollectionTabView({ tab }: { tab: CollectionTab }) {
  return (
    <div className="flex h-full flex-col">
      <CollectionHeader
        connectionId={tab.connectionId}
        database={tab.database}
        collection={tab.collection}
      />
      <EmptyState
        icon={FileJsonIcon}
        title="Document browsing is coming soon"
        description="Viewing, querying and editing documents is the next part of this release. For now this tab shows the collection's statistics."
        className="flex-1"
      />
    </div>
  );
}
