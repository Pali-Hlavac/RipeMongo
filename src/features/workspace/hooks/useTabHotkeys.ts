import { useHotkey } from "@/shared/hooks/useHotkey";

import { useTabsStore } from "../store/tabs";

/** Keyboard shortcuts for tabs. */
export const TAB_HOTKEYS = {
  close: "mod+w",
  next: "ctrl+tab",
  previous: "ctrl+shift+tab",
} as const;

/** Registers global tab shortcuts (close, next, previous). */
export function useTabHotkeys(): void {
  const { closeTab, cycleTab } = useTabsStore.getState();

  useHotkey(TAB_HOTKEYS.close, () => {
    const { activeTabId } = useTabsStore.getState();
    if (activeTabId) closeTab(activeTabId);
  });
  useHotkey(TAB_HOTKEYS.next, () => {
    cycleTab(1);
  });
  useHotkey(TAB_HOTKEYS.previous, () => {
    cycleTab(-1);
  });
}
