import { ChevronRightIcon } from "lucide-react";
import { useContext, useState } from "react";

import { cn } from "@/shared/lib/cn";

import type { BsonField, BsonValue } from "../../lib/bson";
import { CurrentDocumentContext, useDocumentActions } from "../actions/context";
import { ValueText } from "../ValueText";
import { InlineValueEditor } from "./InlineValueEditor";

/** Indentation per nesting level, in pixels (applied inline: depth is unbounded). */
const INDENT_PX = 16;

function children(value: BsonValue): BsonField[] | null {
  if (value.type === "document") return value.fields;
  if (value.type === "array") return value.items.map((item, index) => [String(index), item]);
  return null;
}

interface FieldRowProps {
  name: string;
  /** Dotted path from the document root, e.g. `address.city` or `tags.0`. */
  path: string;
  value: BsonValue;
  depth: number;
}

/**
 * One field of a document; objects and arrays expand to show their contents. Scalar values
 * of writable collections are edited in place: double-click, or focus and press Enter.
 */
export function FieldRow({ name, path, value, depth }: FieldRowProps) {
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
        <LeafValue path={path} value={value} />
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
            <FieldRow
              key={childName}
              name={childName}
              path={`${path}.${childName}`}
              value={child}
              depth={depth + 1}
            />
          ))}
        </ul>
      )}
    </li>
  );
}

function LeafValue({ path, value }: { path: string; value: BsonValue }) {
  const actions = useDocumentActions();
  const document = useContext(CurrentDocumentContext);
  const [editing, setEditing] = useState(false);
  const editable =
    !actions.readOnly && document !== null && path !== "_id" && !path.startsWith("_id.");

  if (!editable) return <ValueText value={value} mode="shell" className="min-w-0 truncate" />;
  if (editing) {
    return (
      <InlineValueEditor
        label={`New value of ${path}`}
        value={value}
        onCancel={() => {
          setEditing(false);
        }}
        onSave={async (text) => {
          await actions.setField(document, path, value, text);
          setEditing(false);
        }}
      />
    );
  }
  return (
    <button
      type="button"
      title="Double-click or press Enter to edit"
      className="min-w-0 truncate rounded-sm text-left outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring"
      onDoubleClick={() => {
        setEditing(true);
      }}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === "F2") {
          event.preventDefault();
          setEditing(true);
        }
      }}
    >
      <ValueText value={value} mode="shell" />
    </button>
  );
}
