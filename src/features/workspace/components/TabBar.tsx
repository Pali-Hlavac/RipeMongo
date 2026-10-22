import { XIcon } from "lucide-react";
import type { KeyboardEvent, ReactNode } from "react";

import { cn } from "@/shared/lib/cn";

import { useTabsStore } from "../store/tabs";

/** Arrow-key offsets for roving focus between tabs. */
const ARROW_OFFSETS: Record<string, number> = { ArrowRight: 1, ArrowLeft: -1 };

/** Horizontal, keyboard-navigable list of open tabs. `actions` renders at the right edge. */
export function TabBar({ actions }: { actions?: ReactNode }) {
  const tabs = useTabsStore((state) => state.tabs);
  const activeTabId = useTabsStore((state) => state.activeTabId);
  const { activateTab, closeTab, cycleTab } = useTabsStore.getState();

  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>): void => {
    const offset = ARROW_OFFSETS[event.key];
    if (offset === undefined) return;
    event.preventDefault();
    cycleTab(offset);
    const nextId = useTabsStore.getState().activeTabId;
    if (nextId) document.getElementById(`tab-${nextId}`)?.focus();
  };

  return (
    <div className="flex h-9 shrink-0 items-stretch border-b border-border bg-muted/40">
      <div role="tablist" aria-label="Open tabs" className="flex min-w-0 flex-1 overflow-x-auto">
        {tabs.map((tab) => {
          const active = tab.id === activeTabId;
          return (
            <div
              key={tab.id}
              className={cn(
                "group flex items-center border-r border-border text-sm",
                active ? "bg-background text-foreground" : "text-muted-foreground hover:bg-accent",
              )}
            >
              <button
                id={`tab-${tab.id}`}
                role="tab"
                aria-selected={active}
                aria-controls="workspace-panel"
                tabIndex={active ? 0 : -1}
                className="h-full truncate py-1 pr-1 pl-3 outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
                onClick={() => {
                  activateTab(tab.id);
                }}
                onKeyDown={onKeyDown}
              >
                {tab.title}
              </button>
              <button
                aria-label={`Close ${tab.title}`}
                className="mr-1 rounded p-0.5 opacity-60 outline-none group-hover:opacity-100 hover:bg-muted focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-ring"
                onClick={() => {
                  closeTab(tab.id);
                }}
              >
                <XIcon className="size-3.5" aria-hidden />
              </button>
            </div>
          );
        })}
      </div>
      {actions && <div className="flex items-center gap-1 px-2">{actions}</div>}
    </div>
  );
}
