/** Workspace tab model. New tab kinds (collection, aggregation, ...) are added per milestone. */
interface TabBase {
  /** Stable identity; opening a tab with an existing id focuses it instead. */
  id: string;
  title: string;
}

export interface WelcomeTab extends TabBase {
  kind: "welcome";
}

/** Overview of one saved connection. */
export interface ConnectionTab extends TabBase {
  kind: "connection";
  connectionId: string;
}

/** Documents of one collection or view. */
export interface CollectionTab extends TabBase {
  kind: "collection";
  connectionId: string;
  database: string;
  collection: string;
}

export type WorkspaceTab = WelcomeTab | ConnectionTab | CollectionTab;
