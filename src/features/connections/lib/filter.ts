/**
 * Which saved connections the sidebar filter shows. The whole text matches a connection's
 * name, folder, host or color label (hosts have dots, so `db.coll` is not split for them);
 * the catalog of connected connections is matched by the catalog's rules.
 */
import type { CatalogSearch, TreeFilter } from "@/features/catalog";
import { fuzzyMatch, type MatchRange } from "@/shared/lib/fuzzy";

import type { ConnectionProfile } from "../types";
import { CONNECTION_COLORS } from "./colors";

export interface ConnectionMatch {
  /** Characters of the name to highlight. */
  ranges: MatchRange[];
  /** The connection itself matched (name, folder, host or color). */
  self: boolean;
  /** Only matching databases and collections; unset shows the whole tree. */
  tree?: TreeFilter;
}

/** Name, folder, a host or the color label: true when one of them matches plain text. */
function matchSelf(profile: ConnectionProfile, text: string): MatchRange[] | null {
  const name = fuzzyMatch(text, profile.name);
  if (name) return name.ranges;
  const needle = text.toLowerCase();
  const folder = profile.folder ? fuzzyMatch(text, profile.folder) : null;
  const host = profile.config.hosts.some(({ host }) => host.toLowerCase().includes(needle));
  const color = CONNECTION_COLORS.some(
    ({ value, label }) => value === profile.color && label.toLowerCase() === needle,
  );
  return folder || host || color ? [] : null;
}

/**
 * Matching connections by id for the trimmed filter `text`; `searches` holds the catalog
 * results of connected ones.
 */
export function matchConnections(
  profiles: readonly ConnectionProfile[],
  text: string,
  searches: ReadonlyMap<string, CatalogSearch>,
): Map<string, ConnectionMatch> {
  const matches = new Map<string, ConnectionMatch>();
  for (const profile of profiles) {
    const ranges = matchSelf(profile, text);
    const search = searches.get(profile.id);
    const inside = search !== undefined && search.databases.size > 0;
    // Still loading: keep a connection that only its catalog could match, to show "Searching…".
    const pending = search?.searching === true && ranges === null;
    if (ranges === null && !inside && !pending) continue;
    matches.set(profile.id, {
      ranges: ranges ?? [],
      self: ranges !== null,
      tree: search && (inside || pending) ? { text, search } : undefined,
    });
  }
  return matches;
}
