/**
 * The sidebar filter applied to databases and collections. Plain text matches either;
 * `db.coll` matches collections named like `coll` in databases named like `db` (either part
 * may be empty). Database names cannot contain dots, so the first dot splits the two.
 */
import { fuzzyMatch, type MatchRange } from "@/shared/lib/fuzzy";

import type { CollectionInfo, DatabaseInfo } from "../types";

export type SidebarFilter =
  { kind: "text"; text: string } | { kind: "namespace"; database: string; collection: string };

/** Parses the filter box; null when it is blank (no filtering). */
export function parseSidebarFilter(input: string): SidebarFilter | null {
  const text = input.trim();
  if (text === "") return null;
  const dot = text.indexOf(".");
  if (dot === -1) return { kind: "text", text };
  return {
    kind: "namespace",
    database: text.slice(0, dot).trim(),
    collection: text.slice(dot + 1).trim(),
  };
}

/** How one database shows while filtering. */
export interface DatabaseMatch {
  /** Characters of the database name to highlight. */
  ranges: MatchRange[];
  /** Matching collections and their highlights, in the database's order. */
  collections: Map<string, MatchRange[]>;
  /** The database itself matched: its collections are all shown when expanded. */
  showAll: boolean;
  /** Open the database because collections in it matched (or are still loading). */
  expand: boolean;
}

/** A database with its collections, when they are loaded. */
export interface SearchedDatabase {
  info: DatabaseInfo;
  collections: CollectionInfo[] | undefined;
}

/** The filter's result for one connected connection. */
export interface CatalogSearch {
  /** Matching databases by name; the others are hidden. */
  databases: Map<string, DatabaseMatch>;
  /** Databases whose collections were not searched because of the limit. */
  notSearched: number;
  /** Lists still loading; matches may still appear. */
  searching: boolean;
}

/** What a connection's tree shows while the sidebar filter is active. */
export interface TreeFilter {
  /** The filter box text; rows toggled by hand are remembered per text. */
  text: string;
  search: CatalogSearch;
}

/** True when the filter targets this database name (always for plain text). */
export function databaseCandidate(filter: SidebarFilter, name: string): boolean {
  return filter.kind === "text" || fuzzyMatch(filter.database, name) !== null;
}

/** Matching databases of one connection, by name; non-matching ones are left out. */
export function matchDatabases(
  filter: SidebarFilter,
  databases: readonly SearchedDatabase[],
): Map<string, DatabaseMatch> {
  const matches = new Map<string, DatabaseMatch>();
  for (const { info, collections } of databases) {
    const match =
      filter.kind === "text"
        ? matchText(filter.text, info.name, collections)
        : matchNamespace(filter, info.name, collections);
    if (match) matches.set(info.name, match);
  }
  return matches;
}

function matchingCollections(query: string, collections: readonly CollectionInfo[] | undefined) {
  const matches = new Map<string, MatchRange[]>();
  for (const { name } of collections ?? []) {
    const match = fuzzyMatch(query, name);
    if (match) matches.set(name, match.ranges);
  }
  return matches;
}

function matchText(
  text: string,
  name: string,
  collections: readonly CollectionInfo[] | undefined,
): DatabaseMatch | null {
  const self = fuzzyMatch(text, name);
  const inside = matchingCollections(text, collections);
  if (!self && inside.size === 0) return null;
  return {
    ranges: self?.ranges ?? [],
    collections: inside,
    showAll: self !== null && inside.size === 0,
    expand: inside.size > 0,
  };
}

function matchNamespace(
  filter: Extract<SidebarFilter, { kind: "namespace" }>,
  name: string,
  collections: readonly CollectionInfo[] | undefined,
): DatabaseMatch | null {
  const self = fuzzyMatch(filter.database, name);
  // Collections not loaded (yet) cannot match; the tree says what was not searched.
  if (!self || !collections) return null;
  const inside = matchingCollections(filter.collection, collections);
  if (inside.size === 0) return null;
  return { ranges: self.ranges, collections: inside, showAll: false, expand: true };
}
