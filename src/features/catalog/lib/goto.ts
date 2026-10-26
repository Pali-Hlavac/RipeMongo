/**
 * "Go to collection": every collection and view of the connected connections, matched like
 * the sidebar filter (plain text, or `db.coll`) and ranked. Recently opened ones come first.
 */
import { fuzzyMatch, type FuzzyMatch, type MatchRange } from "@/shared/lib/fuzzy";

import type { CollectionKind } from "../types";
import { parseSidebarFilter, type SidebarFilter } from "./filter";

/** One collection or view that can be opened. */
export interface NamespaceEntry {
  connectionId: string;
  connectionName: string;
  database: string;
  collection: string;
  kind: CollectionKind;
}

export interface RankedEntry extends NamespaceEntry {
  collectionRanges: MatchRange[];
  databaseRanges: MatchRange[];
  score: number;
}

/** A collection-name match always ranks above a database-name match. */
const DATABASE_ONLY_PENALTY = 10;

interface Recent {
  connectionId: string;
  database: string;
  collection: string;
}

/** Stable key of an entry. */
export function entryKey(entry: Recent): string {
  return `${entry.connectionId}\u0000${entry.database}\u0000${entry.collection}`;
}

function match(entry: NamespaceEntry, filter: SidebarFilter | null): RankedEntry | null {
  const ranked = (score: number, collection?: FuzzyMatch | null, database?: FuzzyMatch | null) => ({
    ...entry,
    score,
    collectionRanges: collection?.ranges ?? [],
    databaseRanges: database?.ranges ?? [],
  });
  if (!filter) return ranked(0);
  if (filter.kind === "namespace") {
    const database = fuzzyMatch(filter.database, entry.database);
    const collection = fuzzyMatch(filter.collection, entry.collection);
    if (!database || !collection) return null;
    return ranked(database.score + collection.score, collection, database);
  }
  const collection = fuzzyMatch(filter.text, entry.collection);
  if (collection) return ranked(collection.score + DATABASE_ONLY_PENALTY, collection);
  const database = fuzzyMatch(filter.text, entry.database);
  return database ? ranked(database.score, null, database) : null;
}

/**
 * Matching entries: recently opened ones in the order they were opened, then the others by
 * score, then connection, database and collection name.
 */
export function rankEntries(
  entries: readonly NamespaceEntry[],
  query: string,
  recent: readonly Recent[],
): { recent: RankedEntry[]; others: RankedEntry[] } {
  const filter = parseSidebarFilter(query);
  const recency = new Map(recent.map((entry, index) => [entryKey(entry), index]));
  const recentMatches: { rank: number; entry: RankedEntry }[] = [];
  const others: RankedEntry[] = [];
  for (const entry of entries) {
    const ranked = match(entry, filter);
    if (!ranked) continue;
    const rank = recency.get(entryKey(entry));
    if (rank === undefined) others.push(ranked);
    else recentMatches.push({ rank, entry: ranked });
  }
  const byName = (a: RankedEntry, b: RankedEntry) =>
    a.connectionName.localeCompare(b.connectionName) ||
    a.database.localeCompare(b.database) ||
    a.collection.localeCompare(b.collection);
  return {
    recent: recentMatches.sort((a, b) => a.rank - b.rank).map(({ entry }) => entry),
    others: others.sort((a, b) => b.score - a.score || byName(a, b)),
  };
}
