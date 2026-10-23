import { useHotkey } from "@/shared/hooks/useHotkey";
import { isDialogOpen } from "@/shared/lib/dialogs";

import { useTabsStore } from "../store/tabs";

/** Keyboard shortcuts for tabs. */
export const TAB_HOTKEYS = {
  close: "mod+w",
  next: "ctrl+tab",
  previous: "ctrl+shift+tab",
} as const;

/** Registers global tab shortcuts (close, next, previous); ignored while a dialog is open. */
export function useTabHotkeys(): void {
  const { closeTab, cycleTab } = useTabsStore.getState();

  useHotkey(TAB_HOTKEYS.close, () => {
    const { activeTabId } = useTabsStore.getState();
    if (activeTabId && !isDialogOpen()) closeTab(activeTabId);
  });
  useHotkey(TAB_HOTKEYS.next, () => {
    if (!isDialogOpen()) cycleTab(1);
  });
  useHotkey(TAB_HOTKEYS.previous, () => {
    if (!isDialogOpen()) cycleTab(-1);
  });
}
