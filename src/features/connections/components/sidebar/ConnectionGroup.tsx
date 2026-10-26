import { ChevronRightIcon } from "lucide-react";
import { useId, useState } from "react";

import { useFilterExpanded, useFilterExpandedStore } from "@/features/catalog";
import { cn } from "@/shared/lib/cn";

import type { ConnectionMatch } from "../../lib/filter";
import type { ConnectionProfile } from "../../types";
import { ConnectionItem } from "./ConnectionItem";

/** The sidebar filter's matches; groups show only these and open while filtering. */
export interface GroupFilter {
  text: string;
  matches: Map<string, ConnectionMatch>;
}

interface ConnectionGroupProps {
  title: string;
  connections: ConnectionProfile[];
  /** Hide the heading (used for the only section in the list). */
  untitled?: boolean;
  filter?: GroupFilter;
}

/** Collapsible sidebar section (Favorites, a folder, or ungrouped connections). */
export function ConnectionGroup({
  title,
  connections,
  untitled = false,
  filter,
}: ConnectionGroupProps) {
  const [stored, setStored] = useState(true);
  const key = `group\u0000${title}`;
  const byFilter = useFilterExpanded(key, filter?.text ?? "", true);
  const expanded = filter ? byFilter : stored;
  const listId = useId();
  const shown = filter
    ? connections.filter((profile) => filter.matches.has(profile.id))
    : connections;
  if (shown.length === 0) return null;

  const list = (
    <ul id={listId} aria-label={title} className="flex flex-col gap-px">
      {shown.map((profile) => (
        <ConnectionItem
          key={profile.id}
          profile={profile}
          match={filter?.matches.get(profile.id)}
          filterText={filter?.text}
        />
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
        data-sidebar-row=""
        className="flex w-full items-center gap-1 rounded-sm px-1 py-1 text-xs font-semibold tracking-wide text-muted-foreground uppercase outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
        onClick={() => {
          if (filter) useFilterExpandedStore.getState().setExpanded(filter.text, key, !expanded);
          else setStored((value) => !value);
        }}
      >
        <ChevronRightIcon
          className={cn("size-3.5 transition-transform", expanded && "rotate-90")}
          aria-hidden
        />
        {title}
        <span className="ml-auto font-normal">{shown.length}</span>
      </button>
      {expanded && list}
    </section>
  );
}
