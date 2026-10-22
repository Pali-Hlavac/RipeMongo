import type { PaletteCommand } from "../types";

/** Groups commands by `group`, preserving first-seen group order and command order. */
export function groupCommands(commands: readonly PaletteCommand[]): [string, PaletteCommand[]][] {
  const groups = new Map<string, PaletteCommand[]>();
  for (const command of commands) {
    const bucket = groups.get(command.group);
    if (bucket) bucket.push(command);
    else groups.set(command.group, [command]);
  }
  return [...groups.entries()];
}
