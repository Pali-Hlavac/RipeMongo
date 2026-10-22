import type { Tool, ToolsInfo } from "@/shared/ipc/bindings";

/** What the About dialog says about the bundled tools. */
export interface ToolsSummary {
  /** Version shared by every available tool, or the versions joined when they differ. */
  version: string | null;
  /** Tools that are missing or could not be run. */
  missing: Tool[];
}

/** Condenses per-tool versions into one line for the About dialog. */
export function summarizeTools(info: ToolsInfo): ToolsSummary {
  const versions = new Set<string>();
  const missing: Tool[] = [];
  for (const status of info.tools) {
    if (status.version === null) missing.push(status.tool);
    else versions.add(status.version);
  }
  return { version: versions.size > 0 ? [...versions].join(", ") : null, missing };
}
