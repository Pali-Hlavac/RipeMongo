import type { ReactNode } from "react";

import { PALETTE_HOTKEY } from "@/features/command-palette";
import { ConnectionOverview } from "@/features/connections";
import { WelcomeView, type WorkspaceTab } from "@/features/workspace";

import { WelcomeActions } from "./WelcomeActions";

/** Maps each workspace tab kind to its feature view. */
export function renderTab(tab: WorkspaceTab): ReactNode {
  switch (tab.kind) {
    case "welcome":
      return <WelcomeView paletteHotkey={PALETTE_HOTKEY} actions={<WelcomeActions />} />;
    case "connection":
      return <ConnectionOverview connectionId={tab.connectionId} />;
  }
}
