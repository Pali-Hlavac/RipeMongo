import { ChevronRightIcon } from "lucide-react";
import { useId, useState } from "react";

import { cn } from "@/shared/lib/cn";

import type { ConnectionProfile } from "../../types";
import { ConnectionItem } from "./ConnectionItem";

interface ConnectionGroupProps {
  title: string;
  connections: ConnectionProfile[];
  /** Hide the heading (used for the only section in the list). */
  untitled?: boolean;
}

/** Collapsible sidebar section (Favorites, a folder, or ungrouped connections). */
export function ConnectionGroup({ title, connections, untitled = false }: ConnectionGroupProps) {
  const [expanded, setExpanded] = useState(true);
  const listId = useId();
  if (connections.length === 0) return null;

  const list = (
    <ul id={listId} aria-label={title} className="flex flex-col gap-px">
      {connections.map((profile) => (
        <ConnectionItem key={profile.id} profile={profile} />
      ))}
    </ul>
  );
  if (untitled) return list;

  return (
    <section>
      <button
        type="button"
        aria-expanded={expanded}
        aria-controls={listId}
        className="flex w-full items-center gap-1 rounded-sm px-1 py-1 text-xs font-semibold tracking-wide text-muted-foreground uppercase outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
        onClick={() => {
          setExpanded((value) => !value);
        }}
      >
        <ChevronRightIcon
          className={cn("size-3.5 transition-transform", expanded && "rotate-90")}
          aria-hidden
        />
        {title}
        <span className="ml-auto font-normal">{connections.length}</span>
      </button>
      {expanded && list}
    </section>
  );
}
