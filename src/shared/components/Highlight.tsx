import type { ReactNode } from "react";

import type { MatchRange } from "@/shared/lib/fuzzy";

interface HighlightProps {
  text: string;
  /** Sorted, non-overlapping `[start, end)` ranges to mark; none renders plain text. */
  ranges?: readonly MatchRange[];
}

/** Text with the characters a filter matched marked. */
export function Highlight({ text, ranges }: HighlightProps) {
  if (!ranges?.length) return <>{text}</>;
  const parts: ReactNode[] = [];
  let at = 0;
  for (const [start, end] of ranges) {
    if (start > at) parts.push(text.slice(at, start));
    parts.push(
      <mark key={start} className="rounded-xs bg-highlight text-highlight-foreground">
        {text.slice(start, end)}
      </mark>,
    );
    at = end;
  }
  if (at < text.length) parts.push(text.slice(at));
  return <>{parts}</>;
}
