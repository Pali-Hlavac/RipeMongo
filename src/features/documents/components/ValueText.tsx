import { cn } from "@/shared/lib/cn";

import type { BsonValue } from "../lib/bson";
import { valueColor } from "../lib/colors";
import { previewText, scalarShell, typeLabel } from "../lib/format";

const MAX_SHELL_CHARS = 200;

interface ValueTextProps {
  value: BsonValue;
  /** `preview`: compact text for table cells; `shell`: mongosh syntax for the tree. */
  mode: "preview" | "shell";
  className?: string;
}

/** One value, colored by type; the tooltip names the BSON type. */
export function ValueText({ value, mode, className }: ValueTextProps) {
  const container = value.type === "document" || value.type === "array";
  const full = mode === "shell" && !container ? scalarShell(value) : previewText(value);
  const text = full.length > MAX_SHELL_CHARS ? `${full.slice(0, MAX_SHELL_CHARS)}…` : full;
  return (
    <span
      className={cn("font-mono whitespace-pre", valueColor(value), className)}
      title={`${typeLabel(value)}${text === full ? "" : `: ${full}`}`}
    >
      {text}
    </span>
  );
}
