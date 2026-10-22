import { useId, useRef, useState, type KeyboardEvent } from "react";

import { cn } from "@/shared/lib/cn";
import { fieldClassName } from "@/shared/ui/input";

import {
  applySuggestion,
  completionContext,
  suggest,
  type CompletionContext,
  type QueryPart,
  type Suggestion,
} from "../../lib/completion";

interface QueryInputProps {
  id?: string;
  part: QueryPart;
  value: string;
  onChange: (value: string) => void;
  /** Known field paths, offered as keys. */
  fields: readonly string[];
  placeholder?: string;
  invalid?: boolean;
  "aria-describedby"?: string;
  className?: string;
}

interface Open {
  context: CompletionContext;
  items: Suggestion[];
  active: number;
}

/**
 * Single-line query input with an autocomplete list (ARIA combobox). Suggestions follow
 * typing; Ctrl+Space opens them on demand; ↑/↓ choose, Enter/Tab accept, Esc closes.
 * Enter without an open list submits the surrounding form.
 */
export function QueryInput({
  part,
  value,
  onChange,
  fields,
  invalid,
  className,
  ...rest
}: QueryInputProps) {
  const listId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState<Open | null>(null);

  const refresh = (text: string, caret: number, force = false) => {
    const context = completionContext(text, caret);
    const items =
      context && (force || context.word.length > 0) ? suggest(context, part, fields) : [];
    setOpen(context && items.length > 0 ? { context, items, active: 0 } : null);
  };

  const accept = (item: Suggestion) => {
    const input = inputRef.current;
    if (!input || !open) return;
    const next = applySuggestion(value, input.selectionStart ?? value.length, open.context, item);
    onChange(next.text);
    setOpen(null);
    requestAnimationFrame(() => {
      input.setSelectionRange(next.caret, next.caret);
    });
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === " " && event.ctrlKey) {
      event.preventDefault();
      refresh(value, event.currentTarget.selectionStart ?? value.length, true);
      return;
    }
    if (!open) return;
    const count = open.items.length;
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      const step = event.key === "ArrowDown" ? 1 : -1;
      setOpen({ ...open, active: (open.active + step + count) % count });
    } else if (event.key === "Enter" || event.key === "Tab") {
      const item = open.items[open.active];
      if (item) {
        event.preventDefault();
        accept(item);
      }
    } else if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      setOpen(null);
    }
  };

  const activeId = open ? `${listId}-${open.active}` : undefined;
  return (
    <div className={cn("relative", className)}>
      <input
        {...rest}
        ref={inputRef}
        role="combobox"
        aria-expanded={open !== null}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={activeId}
        aria-invalid={invalid ? true : undefined}
        autoComplete="off"
        spellCheck={false}
        className={cn(fieldClassName, "h-8 font-mono placeholder:text-muted-foreground/50")}
        value={value}
        onChange={(event) => {
          onChange(event.target.value);
          refresh(event.target.value, event.target.selectionStart ?? event.target.value.length);
        }}
        onKeyDown={onKeyDown}
        onBlur={() => {
          setOpen(null);
        }}
      />
      <ul
        id={listId}
        role="listbox"
        aria-label="Suggestions"
        hidden={open === null}
        className="absolute top-full left-0 z-50 mt-1 min-w-56 overflow-hidden rounded-md border border-border bg-popover p-1 text-sm shadow-md"
      >
        {open?.items.map((item, index) => (
          <li
            key={item.label}
            id={`${listId}-${index}`}
            role="option"
            aria-selected={index === open.active}
            className={cn(
              "flex cursor-default items-center justify-between gap-4 rounded-sm px-2 py-1 font-mono",
              index === open.active && "bg-accent text-accent-foreground",
            )}
            // Keep focus in the input; accept on mouse down before blur closes the list.
            onMouseDown={(event) => {
              event.preventDefault();
              accept(item);
            }}
          >
            {item.label}
            <span className="font-sans text-xs text-muted-foreground">{item.kind}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
