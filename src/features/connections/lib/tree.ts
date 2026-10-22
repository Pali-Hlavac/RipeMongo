/** Groups saved connections for the sidebar: favorites, then folders, then the rest. */
import type { ConnectionProfile } from "../types";

export interface ConnectionFolder {
  name: string;
  connections: ConnectionProfile[];
}

export interface ConnectionTree {
  favorites: ConnectionProfile[];
  folders: ConnectionFolder[];
  ungrouped: ConnectionProfile[];
}

const byName = (a: { name: string }, b: { name: string }) =>
  a.name.localeCompare(b.name, undefined, { sensitivity: "base" });

/** Favorites appear in their own section and also stay in their folder. */
export function buildConnectionTree(profiles: readonly ConnectionProfile[]): ConnectionTree {
  const folders = new Map<string, ConnectionProfile[]>();
  const ungrouped: ConnectionProfile[] = [];
  for (const profile of profiles) {
    const folder = profile.folder?.trim();
    if (!folder) {
      ungrouped.push(profile);
      continue;
    }
    const bucket = folders.get(folder);
    if (bucket) bucket.push(profile);
    else folders.set(folder, [profile]);
  }
  return {
    favorites: profiles.filter((profile) => profile.favorite).sort(byName),
    folders: [...folders.entries()]
      .map(([name, connections]) => ({ name, connections: connections.sort(byName) }))
      .sort(byName),
    ungrouped: ungrouped.sort(byName),
  };
}

/** Distinct, sorted folder names (for the folder picker). */
export function folderNames(profiles: readonly ConnectionProfile[]): string[] {
  const names = profiles
    .map((profile) => profile.folder?.trim())
    .filter((name): name is string => Boolean(name));
  return [...new Set(names)].sort((a, b) => a.localeCompare(b));
}
