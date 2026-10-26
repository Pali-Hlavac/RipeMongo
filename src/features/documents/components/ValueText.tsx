import { cn } from "@/shared/lib/cn";

import type { BsonValue } from "../lib/bson";
import { valueColor } from "../lib/colors";
import { occurrences } from "../lib/find";
import { previewText, scalarShell, typeLabel } from "../lib/format";
import { useFind } from "./find/context";
import { FindText } from "./find/FindText";

const MAX_SHELL_CHARS = 200;

interface ValueTextProps {
  value: BsonValue;
  /** `preview`: compact text for table cells; `shell`: mongosh syntax for the tree. */
  mode: "preview" | "shell";
  className?: string;
  /** Highlight "Find on this page" hits in it (see `lib/find.ts`). */
  findPrefix?: string;
}

/** One value, colored by type; the tooltip names the BSON type. */
export function ValueText({ value, mode, className, findPrefix }: ValueTextProps) {
  const { needle } = useFind();
  const container = value.type === "document" || value.type === "array";
  const full = mode === "shell" && !container ? scalarShell(value) : previewText(value);
  // A value with hits is shown whole, so every hit can be highlighted.
  const found = findPrefix !== undefined && occurrences(full, needle).length > 0;
  const text =
    !found && full.length > MAX_SHELL_CHARS ? `${full.slice(0, MAX_SHELL_CHARS)}…` : full;
  return (
    <span
      className={cn("font-mono whitespace-pre", valueColor(value), className)}
      title={`${typeLabel(value)}${text === full ? "" : `: ${full}`}`}
    >
      {findPrefix === undefined ? text : <FindText text={text} prefix={findPrefix} />}
    </span>
  );
}
