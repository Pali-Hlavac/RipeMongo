import { StarIcon } from "lucide-react";

import { cn } from "@/shared/lib/cn";

import { openConnectionTab, useConnectionSession } from "../../api/session";
import { useConnectionStatus } from "../../hooks/useConnectionStatus";
import { colorClass } from "../../lib/colors";
import type { ConnectionProfile } from "../../types";
import { StatusIndicator } from "../StatusIndicator";
import { ConnectionActionsMenu } from "./ConnectionActionsMenu";

/**
 * One saved connection in the sidebar. Click opens its tab; double-click (or Enter)
 * also connects.
 */
export function ConnectionItem({ profile }: { profile: ConnectionProfile }) {
  const { status } = useConnectionStatus(profile.id);
  const { connect } = useConnectionSession();

  return (
    <li className="group relative flex items-center gap-1 rounded-sm pr-1 hover:bg-accent">
      <span
        aria-hidden
        className={cn("absolute inset-y-1 left-0 w-0.5 rounded-full", colorClass(profile.color))}
      />
      <button
        type="button"
        className="flex min-w-0 flex-1 items-center gap-2 rounded-sm py-1 pr-1 pl-3 text-left text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
        title={profile.name}
        onClick={() => {
          openConnectionTab(profile);
        }}
        onDoubleClick={() => void connect(profile)}
        onKeyDown={(event) => {
          if (event.key === "Enter" && status !== "connected") {
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
    </li>
  );
}
