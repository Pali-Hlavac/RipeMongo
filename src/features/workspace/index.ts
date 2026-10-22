/** Public API of the workspace (tabs) feature. */
export { WelcomeView } from "./components/WelcomeView";
export { WorkspaceView } from "./components/WorkspaceView";
export { TAB_HOTKEYS } from "./hooks/useTabHotkeys";
export { WELCOME_TAB, useTabsStore } from "./store/tabs";
export type { CollectionTab, ConnectionTab, WorkspaceTab } from "./types";
