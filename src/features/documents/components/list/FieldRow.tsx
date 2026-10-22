import { ChevronRightIcon } from "lucide-react";
import { useState } from "react";

import { cn } from "@/shared/lib/cn";

import type { BsonField, BsonValue } from "../../lib/bson";
import { ValueText } from "../ValueText";

/** Indentation per nesting level, in pixels (applied inline: depth is unbounded). */
const INDENT_PX = 16;

function children(value: BsonValue): BsonField[] | null {
  if (value.type === "document") return value.fields;
  if (value.type === "array") return value.items.map((item, index) => [String(index), item]);
  return null;
}

interface FieldRowProps {
  name: string;
  value: BsonValue;
  depth: number;
}

/** One field of a document; objects and arrays expand to show their contents. */
export function FieldRow({ name, value, depth }: FieldRowProps) {
  const [expanded, setExpanded] = useState(false);
  const nested = children(value);
  const indent = { paddingLeft: depth * INDENT_PX };
  const key = (
    <span className="shrink-0 font-mono">
      <span className="text-syntax-key">{name}</span>
      <span className="text-muted-foreground">:</span>
    </span>
  );

  if (nested === null || nested.length === 0) {
    return (
      <li className="flex min-w-0 items-baseline gap-1.5 py-px pl-5" style={indent}>
        {key}
        <ValueText value={value} mode="shell" className="min-w-0 truncate" />
      </li>
    );
  }

  return (
    <li>
      <button
        type="button"
        aria-expanded={expanded}
        className="flex w-full min-w-0 items-baseline gap-1.5 rounded-sm py-px text-left outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring"
        style={indent}
        onClick={() => {
          setExpanded((open) => !open);
        }}
      >
        <ChevronRightIcon
          className={cn(
            "size-3.5 shrink-0 self-center transition-transform",
            expanded && "rotate-90",
          )}
          aria-hidden
        />
        {key}
        <ValueText value={value} mode="preview" />
      </button>
      {expanded && (
        <ul>
          {nested.map(([childName, child]) => (
            <FieldRow key={childName} name={childName} value={child} depth={depth + 1} />
          ))}
        </ul>
      )}
    </li>
  );
}
