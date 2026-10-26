import { SearchIcon, XIcon } from "lucide-react";
import type { RefObject } from "react";

import { useHotkey } from "@/shared/hooks/useHotkey";
import { formatHotkey } from "@/shared/lib/hotkeys";
import { isMacPlatform } from "@/shared/lib/platform";
import { Input } from "@/shared/ui/input";

import { useSidebarFilter } from "../../store/filter";

/** Focuses the sidebar filter box from anywhere. */
export const SIDEBAR_FILTER_HOTKEY = "mod+shift+f";

interface SidebarFilterBoxProps {
  inputRef: RefObject<HTMLInputElement | null>;
  onFocusRequest: () => void;
  onArrowDown: () => void;
  onEnter: () => void;
}

/** Filter box above the connection tree. */
export function SidebarFilterBox({
  inputRef,
  onFocusRequest,
  onArrowDown,
  onEnter,
}: SidebarFilterBoxProps) {
  const input = useSidebarFilter((state) => state.input);
  const setInput = useSidebarFilter((state) => state.setInput);
  useHotkey(SIDEBAR_FILTER_HOTKEY, onFocusRequest);
  const shortcut = formatHotkey(SIDEBAR_FILTER_HOTKEY, isMacPlatform());

  return (
    <div className="relative shrink-0 border-b border-border p-1.5">
      <SearchIcon
        className="pointer-events-none absolute top-1/2 left-3.5 size-3.5 -translate-y-1/2 text-muted-foreground"
        aria-hidden
      />
      <Input
        ref={inputRef}
        type="search"
        value={input}
        placeholder={`Filter (${shortcut})`}
        aria-label="Filter connections, databases and collections"
        aria-keyshortcuts={shortcut}
        title="Matches names, hosts, folders and colors; type database.collection to narrow"
        className="h-7 px-7 text-xs [&::-webkit-search-cancel-button]:hidden"
        spellCheck={false}
        autoComplete="off"
        onChange={(event) => {
          setInput(event.target.value);
        }}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown") {
            event.preventDefault();
            onArrowDown();
          } else if (event.key === "Enter") {
            event.preventDefault();
            onEnter();
          } else if (event.key === "Escape" && input) {
            // Clear first; a second Escape can close whatever is around.
            event.preventDefault();
            event.stopPropagation();
            setInput("");
          }
        }}
      />
      {input && (
        <button
          type="button"
          aria-label="Clear filter"
          className="absolute top-1/2 right-3 -translate-y-1/2 rounded-sm p-0.5 text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
          onClick={() => {
            setInput("");
            inputRef.current?.focus();
          }}
        >
          <XIcon className="size-3.5" aria-hidden />
        </button>
      )}
    </div>
  );
}
