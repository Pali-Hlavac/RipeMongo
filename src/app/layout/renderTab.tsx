import type { ReactNode } from "react";

import { PALETTE_HOTKEY } from "@/features/command-palette";
import { WelcomeView, type WorkspaceTab } from "@/features/workspace";

/**
 * Maps each workspace tab kind to its feature view. Connection tabs cannot be opened yet;
 * their overview view is wired here together with the connection sidebar (milestone 2).
 */
export function renderTab(tab: WorkspaceTab): ReactNode {
  switch (tab.kind) {
    case "welcome":
      return <WelcomeView paletteHotkey={PALETTE_HOTKEY} />;
    case "connection":
      return null;
  }
}
