import { ChevronDownIcon, ChevronUpIcon, SearchIcon, XIcon } from "lucide-react";
import type { RefObject } from "react";

import { formatCount } from "@/shared/lib/format";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";

interface FindBarProps {
  inputRef: RefObject<HTMLInputElement | null>;
  needle: string;
  onNeedleChange: (needle: string) => void;
  count: number;
  /** Zero-based index of the current hit. */
  position: number;
  /** Documents on the page, for the "page only" note. */
  documents: number;
  onNext: () => void;
  onPrevious: () => void;
  onClose: () => void;
}

/** Find on this page: never queries the database, only what is loaded. */
export function FindBar({
  inputRef,
  needle,
  onNeedleChange,
  count,
  position,
  documents,
  onNext,
  onPrevious,
  onClose,
}: FindBarProps) {
  const status = count > 0 ? `${formatCount(position + 1)} of ${formatCount(count)}` : "No matches";
  const note = `Searches only the ${formatCount(documents)} ${documents === 1 ? "document" : "documents"} on this page, not the collection. Use the filter to query the database.`;
  return (
    <div
      role="search"
      aria-label="Find on this page"
      className="flex items-center gap-2 border-b border-border bg-muted/40 px-4 py-1"
    >
      <SearchIcon className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
      <Input
        ref={inputRef}
        value={needle}
        placeholder="Find on this page"
        aria-label="Find on this page"
        className="h-7 w-56 shrink-0 text-xs"
        spellCheck={false}
        autoComplete="off"
        onChange={(event) => {
          onNeedleChange(event.target.value);
        }}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            if (event.shiftKey) onPrevious();
            else onNext();
          } else if (event.key === "Escape") {
            event.preventDefault();
            onClose();
          }
        }}
      />
      <span
        aria-live="polite"
        className="min-w-16 shrink-0 text-xs text-muted-foreground tabular-nums"
      >
        {needle && status}
      </span>
      <Button
        variant="ghost"
        size="icon"
        className="size-7"
        aria-label="Previous match"
        title="Previous match (Shift+Enter)"
        disabled={count === 0}
        onClick={onPrevious}
      >
        <ChevronUpIcon aria-hidden />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        className="size-7"
        aria-label="Next match"
        title="Next match (Enter)"
        disabled={count === 0}
        onClick={onNext}
      >
        <ChevronDownIcon aria-hidden />
      </Button>
      {/* One line: cut off with "…" in narrow windows, the full text in the tooltip. */}
      <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground" title={note}>
        {note}
      </span>
      <Button
        variant="ghost"
        size="icon"
        className="size-7 shrink-0"
        aria-label="Close find"
        onClick={onClose}
      >
        <XIcon aria-hidden />
      </Button>
    </div>
  );
}
