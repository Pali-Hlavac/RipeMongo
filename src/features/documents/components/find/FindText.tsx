import type { ReactNode } from "react";

import { findId, occurrences } from "../../lib/find";
import { useFind } from "./context";

/** `text` with every occurrence of the find text marked; the current one stands out. */
export function FindText({ text, prefix }: { text: string; prefix: string }) {
  const { needle, current } = useFind();
  const starts = occurrences(text, needle);
  if (starts.length === 0) return <>{text}</>;
  const parts: ReactNode[] = [];
  let at = 0;
  starts.forEach((start, index) => {
    if (start > at) parts.push(text.slice(at, start));
    const isCurrent = findId(prefix, index) === current;
    parts.push(
      <mark
        key={start}
        data-find-current={isCurrent ? "" : undefined}
        className={
          isCurrent
            ? "rounded-xs bg-ring text-primary-foreground"
            : "rounded-xs bg-highlight text-highlight-foreground"
        }
      >
        {text.slice(start, start + needle.length)}
      </mark>,
    );
    at = start + needle.length;
  });
  if (at < text.length) parts.push(text.slice(at));
  return <>{parts}</>;
}
