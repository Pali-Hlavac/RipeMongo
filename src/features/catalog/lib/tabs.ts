/** Workspace tabs that show one collection, and keeping them in sync with catalog changes. */
import { useTabsStore, type CollectionTab, type WorkspaceTab } from "@/features/workspace";

/** Stable id of a collection's tab: one tab per namespace and connection. */
export function collectionTabId(connectionId: string, database: string, collection: string) {
  return `collection:${connectionId}:${database}.${collection}`;
}

/** Opens (or focuses) the tab of a collection or view. */
export function openCollectionTab(connectionId: string, database: string, collection: string) {
  useTabsStore.getState().openTab({
    id: collectionTabId(connectionId, database, collection),
    kind: "collection",
    connectionId,
    database,
    collection,
    title: collection,
  });
}

function isCollectionTab(tab: WorkspaceTab): tab is CollectionTab {
  return tab.kind === "collection";
}

/** Closes the tabs of a dropped database, or of one dropped collection when given. */
export function closeCollectionTabs(connectionId: string, database: string, collection?: string) {
  useTabsStore
    .getState()
    .closeTabs(
      (tab) =>
        isCollectionTab(tab) &&
        tab.connectionId === connectionId &&
        tab.database === database &&
        (collection === undefined || tab.collection === collection),
    );
}

/** Points an open tab at a renamed collection, keeping its position and focus. */
export function renameCollectionTab(
  connectionId: string,
  database: string,
  from: string,
  to: string,
) {
  const { tabs, replaceTab } = useTabsStore.getState();
  const oldId = collectionTabId(connectionId, database, from);
  const open = tabs.find((tab) => tab.id === oldId);
  if (!open || !isCollectionTab(open)) return;
  replaceTab(oldId, {
    ...open,
    id: collectionTabId(connectionId, database, to),
    collection: to,
    title: to,
  });
}
