import { LoaderCircleIcon } from "lucide-react";
import { useState } from "react";

import { useTabsStore } from "@/features/workspace";
import { Highlight } from "@/shared/components/Highlight";
import { formatCount } from "@/shared/lib/format";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/shared/ui/command";

import { useCatalogLists } from "../../api/search";
import { databaseCandidate, parseSidebarFilter } from "../../lib/filter";
import { entryKey, rankEntries, type NamespaceEntry, type RankedEntry } from "../../lib/goto";
import { collectionTabId, openCollectionTab } from "../../lib/tabs";
import { useRecentCollections } from "../../store/recent";
import { KIND_ICONS, KIND_LABELS } from "../kinds";

/** At most this many results are listed; typing narrows them. */
const RESULT_LIMIT = 100;

export interface ConnectedConnection {
  id: string;
  name: string;
}

interface GoToCollectionListProps {
  connections: ConnectedConnection[];
  onDone: () => void;
}

/** The search box and results; mounted while the picker is open. */
export function GoToCollectionList({ connections, onDone }: GoToCollectionListProps) {
  const [query, setQuery] = useState("");
  const filter = parseSidebarFilter(query);
  const lists = useCatalogLists(
    connections.map((connection) => connection.id),
    (name) => !filter || databaseCandidate(filter, name),
  );
  const names = new Map(connections.map((connection) => [connection.id, connection.name]));
  const entries: NamespaceEntry[] = lists.flatMap(({ connectionId, collections }) =>
    [...collections].flatMap(([database, list]) =>
      (list ?? []).map((info) => ({
        connectionId,
        connectionName: names.get(connectionId) ?? "",
        database,
        collection: info.name,
        kind: info.kind,
      })),
    ),
  );
  // The collection already on screen is left out, so Enter goes back to the previous one.
  const activeTabId = useTabsStore((state) => state.activeTabId);
  const recent = useRecentCollections((state) => state.recent).filter(
    (entry) =>
      collectionTabId(entry.connectionId, entry.database, entry.collection) !== activeTabId,
  );
  const ranked = rankEntries(entries, query, recent);
  const shown = ranked.others.slice(0, RESULT_LIMIT);
  const searching = lists.some((list) => list.searching);
  const notSearched = lists.reduce((sum, list) => sum + list.notSearched, 0);
  const several = connections.length > 1;

  const item = (entry: RankedEntry) => {
    const Icon = KIND_ICONS[entry.kind];
    return (
      <CommandItem
        key={entryKey(entry)}
        value={entryKey(entry)}
        onSelect={() => {
          openCollectionTab(entry.connectionId, entry.database, entry.collection);
          onDone();
        }}
      >
        <Icon className="text-muted-foreground" aria-hidden />
        <span className="truncate">
          <Highlight text={entry.collection} ranges={entry.collectionRanges} />
        </span>
        {entry.kind !== "collection" && (
          <span className="sr-only">({KIND_LABELS[entry.kind]})</span>
        )}
        <span className="ml-auto truncate pl-2 text-xs text-muted-foreground">
          <Highlight text={entry.database} ranges={entry.databaseRanges} />
          {several && ` · ${entry.connectionName}`}
        </span>
      </CommandItem>
    );
  };

  return (
    <Command shouldFilter={false} loop label="Go to collection">
      <CommandInput
        placeholder="Go to collection… (database.collection narrows)"
        value={query}
        onValueChange={setQuery}
      />
      <CommandList>
        {!searching && (
          <CommandEmpty>
            {connections.length === 0
              ? "Connect to a server to go to its collections."
              : "No matching collections."}
          </CommandEmpty>
        )}
        {ranked.recent.length > 0 && (
          <CommandGroup heading="Recently opened">{ranked.recent.map(item)}</CommandGroup>
        )}
        {shown.length > 0 && (
          <CommandGroup heading={ranked.recent.length > 0 ? "Collections" : undefined}>
            {shown.map(item)}
          </CommandGroup>
        )}
      </CommandList>
      <GoToFooter
        searching={searching}
        hidden={ranked.others.length - shown.length}
        notSearched={notSearched}
      />
    </Command>
  );
}

interface GoToFooterProps {
  searching: boolean;
  /** Matches beyond the result limit. */
  hidden: number;
  notSearched: number;
}

function GoToFooter({ searching, hidden, notSearched }: GoToFooterProps) {
  const notes = [
    hidden > 0 && `${formatCount(hidden)} more; keep typing to narrow.`,
    notSearched > 0 &&
      `${formatCount(notSearched)} ${notSearched === 1 ? "database was" : "databases were"} not searched; type database.collection.`,
  ].filter(Boolean);
  if (!searching && notes.length === 0) return null;
  return (
    <div
      role="status"
      className="flex items-center gap-1.5 border-t border-border px-3 py-1.5 text-xs text-muted-foreground"
    >
      {searching && <LoaderCircleIcon className="size-3.5 animate-spin" aria-hidden />}
      {searching ? "Searching…" : notes.join(" ")}
    </div>
  );
}
