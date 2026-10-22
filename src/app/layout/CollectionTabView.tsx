import { CollectionHeader } from "@/features/catalog";
import { CollectionDocuments } from "@/features/documents";
import type { CollectionTab } from "@/features/workspace";

/** A collection tab: header with statistics, then its documents. */
export function CollectionTabView({ tab }: { tab: CollectionTab }) {
  const target = {
    connectionId: tab.connectionId,
    database: tab.database,
    collection: tab.collection,
  };
  return (
    <div className="flex h-full flex-col">
      <CollectionHeader {...target} />
      <CollectionDocuments tabId={tab.id} {...target} />
    </div>
  );
}
