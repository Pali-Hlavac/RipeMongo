import { SearchXIcon } from "lucide-react";

import { parseSidebarFilter, useCatalogSearch } from "@/features/catalog";
import { EmptyState } from "@/shared/components/EmptyState";
import { Button } from "@/shared/ui/button";

import { useActiveConnections } from "../../api/session";
import { matchConnections } from "../../lib/filter";
import { buildConnectionTree } from "../../lib/tree";
import { useSidebarFilter } from "../../store/filter";
import type { ConnectionProfile } from "../../types";
import { ConnectionGroup } from "./ConnectionGroup";

/** Favorites, folders and the rest; only the matches while the filter box has text. */
export function ConnectionTreeView({ profiles }: { profiles: ConnectionProfile[] }) {
  const input = useSidebarFilter((state) => state.input);
  const filter = parseSidebarFilter(input);
  const { data: active = [] } = useActiveConnections();
  const searches = useCatalogSearch(
    active.map((connection) => connection.connectionId),
    filter,
  );
  const text = input.trim();
  const matches = filter ? matchConnections(profiles, text, searches) : undefined;
  const groupFilter = matches ? { text, matches } : undefined;
  const tree = buildConnectionTree(profiles);
  const onlyUngrouped = tree.favorites.length === 0 && tree.folders.length === 0;

  if (matches?.size === 0) {
    return (
      <EmptyState
        icon={SearchXIcon}
        title={`Nothing matches “${text}”`}
        description="Databases and collections are searched only in connected connections."
        action={
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              useSidebarFilter.getState().setInput("");
            }}
          >
            Clear filter
          </Button>
        }
      />
    );
  }
  return (
    <div className="flex flex-col gap-2">
      <ConnectionGroup title="Favorites" connections={tree.favorites} filter={groupFilter} />
      {tree.folders.map((folder) => (
        <ConnectionGroup
          key={folder.name}
          title={folder.name}
          connections={folder.connections}
          filter={groupFilter}
        />
      ))}
      <ConnectionGroup
        title="Other"
        connections={tree.ungrouped}
        untitled={onlyUngrouped}
        filter={groupFilter}
      />
    </div>
  );
}
