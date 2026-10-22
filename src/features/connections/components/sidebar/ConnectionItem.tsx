import { ChevronRightIcon, StarIcon } from "lucide-react";
import { useId } from "react";

import { DatabaseTree } from "@/features/catalog";
import { cn } from "@/shared/lib/cn";

import { openConnectionTab, useConnectionSession } from "../../api/session";
import { useConnectionStatus } from "../../hooks/useConnectionStatus";
import { colorClass } from "../../lib/colors";
import { useExpandedConnections } from "../../store/expanded";
import type { ConnectionProfile } from "../../types";
import { StatusIndicator } from "../StatusIndicator";
import { ConnectionActionsMenu } from "./ConnectionActionsMenu";

/**
 * One saved connection in the sidebar. Click opens its tab; double-click (or Enter)
 * also connects. While connected, the chevron shows its databases and collections.
 */
export function ConnectionItem({ profile }: { profile: ConnectionProfile }) {
  const { status } = useConnectionStatus(profile.id);
  const { connect } = useConnectionSession();
  const expandedFlag = useExpandedConnections((state) => state.expanded[profile.id] ?? false);
  const setExpanded = useExpandedConnections((state) => state.setExpanded);
  const treeId = useId();
  const connected = status === "connected";
  const expanded = connected && expandedFlag;

  return (
    <li>
      <div className="group relative flex items-center gap-1 rounded-sm pr-1 hover:bg-accent">
        <span
          aria-hidden
          className={cn("absolute inset-y-1 left-0 w-0.5 rounded-full", colorClass(profile.color))}
        />
        {connected ? (
          <button
            type="button"
            aria-label={
              expanded ? `Hide databases of ${profile.name}` : `Show databases of ${profile.name}`
            }
            aria-expanded={expanded}
            aria-controls={expanded ? treeId : undefined}
            className="ml-1 rounded-sm p-0.5 text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
            onClick={() => {
              setExpanded(profile.id, !expanded);
            }}
          >
            <ChevronRightIcon
              className={cn("size-3.5 transition-transform", expanded && "rotate-90")}
              aria-hidden
            />
          </button>
        ) : (
          <span aria-hidden className="ml-1 w-4.5 shrink-0" />
        )}
        <button
          type="button"
          className="flex min-w-0 flex-1 items-center gap-2 rounded-sm py-1 pr-1 text-left text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
          title={profile.name}
          onClick={() => {
            openConnectionTab(profile);
          }}
          onDoubleClick={() => void connect(profile)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !connected) {
              event.preventDefault();
              void connect(profile);
            }
          }}
        >
          <StatusIndicator status={status} />
          <span className="truncate">{profile.name}</span>
          {profile.favorite && (
            <StarIcon
              className="size-3 shrink-0 fill-amber-400 text-amber-400"
              aria-label="Favorite"
            />
          )}
        </button>
        <ConnectionActionsMenu profile={profile} status={status} />
      </div>
      {expanded && (
        <DatabaseTree
          id={treeId}
          connectionId={profile.id}
          label={`Databases in ${profile.name}`}
        />
      )}
    </li>
  );
}
