import { CollectionHeader, useCollectionInfo } from "@/features/catalog";
import { CollectionDocuments } from "@/features/documents";
import type { CollectionTab } from "@/features/workspace";

/** A collection tab: header with statistics, then its documents. */
export function CollectionTabView({ tab }: { tab: CollectionTab }) {
  const target = {
    connectionId: tab.connectionId,
    database: tab.database,
    collection: tab.collection,
  };
  const info = useCollectionInfo(tab.connectionId, tab.database, tab.collection);
  // Writable only once known to be a regular collection: views never get edit actions.
  const readOnly = !info || info.kind === "view" || info.readOnly;
  return (
    <div className="flex h-full flex-col">
      <CollectionHeader {...target} />
      <CollectionDocuments tabId={tab.id} readOnly={readOnly} {...target} />
    </div>
  );
}
