/** Workspace tab model. New tab kinds (collection, aggregation, ...) are added per milestone. */
export interface WorkspaceTab {
  /** Stable identity; opening a tab with an existing id focuses it instead. */
  id: string;
  kind: "welcome";
  title: string;
}
