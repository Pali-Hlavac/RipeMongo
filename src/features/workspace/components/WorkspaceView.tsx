import { LayoutGridIcon } from "lucide-react";
import type { ReactNode } from "react";

import { EmptyState } from "@/shared/components/EmptyState";
import { Button } from "@/shared/ui/button";

import { useTabHotkeys } from "../hooks/useTabHotkeys";
import { WELCOME_TAB, useActiveTab, useTabsStore } from "../store/tabs";
import type { WorkspaceTab } from "../types";
import { TabBar } from "./TabBar";

interface WorkspaceViewProps {
  /** Renders the content of a tab; the app shell maps tab kinds to feature views. */
  renderTab: (tab: WorkspaceTab) => ReactNode;
  /** Extra controls shown at the right end of the tab bar. */
  tabBarActions?: ReactNode;
}

/** Tab bar plus the content of the active tab. */
export function WorkspaceView({ renderTab, tabBarActions }: WorkspaceViewProps) {
  useTabHotkeys();
  const activeTab = useActiveTab();

  return (
    <div className="flex h-full min-h-0 flex-col">
      <TabBar actions={tabBarActions} />
      <div
        id="workspace-panel"
        role="tabpanel"
        aria-labelledby={activeTab ? `tab-${activeTab.id}` : undefined}
        className="min-h-0 flex-1 overflow-auto"
      >
        {activeTab ? (
          renderTab(activeTab)
        ) : (
          <EmptyState
            icon={LayoutGridIcon}
            title="No open tabs"
            className="h-full"
            action={
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  useTabsStore.getState().openTab(WELCOME_TAB);
                }}
              >
                Open Welcome tab
              </Button>
            }
          />
        )}
      </div>
    </div>
  );
}
