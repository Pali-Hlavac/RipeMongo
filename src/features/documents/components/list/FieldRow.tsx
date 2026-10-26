import { ChevronRightIcon } from "lucide-react";
import { useContext, useState } from "react";

import { cn } from "@/shared/lib/cn";

import type { BsonField, BsonValue } from "../../lib/bson";
import { findPrefix, isWithin, pathKey } from "../../lib/find";
import { CurrentDocumentContext, useDocumentActions } from "../actions/context";
import { useFind } from "../find/context";
import { FindText } from "../find/FindText";
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
  /** An array item: its name is the position, which find does not search. */
  inArray?: boolean;
}

/**
 * One field of a document; objects and arrays expand to show their contents. Scalar values
 * of writable collections are edited in place: double-click, or focus and press Enter.
 */
export function FieldRow({ name, path, value, depth, inArray = false }: FieldRowProps) {
  // Unset follows "Find on this page" (open when it holds hits) until toggled by hand.
  const [toggled, setToggled] = useState<boolean | null>(null);
  const document = useContext(CurrentDocumentContext);
  const find = useFind();
  const documentKey = document?.key ?? "";
  const expanded = toggled ?? find.open.has(pathKey(documentKey, path));
  const nested = children(value);
  const indent = { paddingLeft: depth * INDENT_PX };
  const key = (
    <span className="shrink-0 font-mono">
      <span className="text-syntax-key">
        {inArray ? name : <FindText text={name} prefix={findPrefix(documentKey, path, "key")} />}
      </span>
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
          setToggled(!expanded);
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
              inArray={value.type === "array"}
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
  const { current } = useFind();
  const [editing, setEditing] = useState(false);
  const editable =
    !actions.readOnly && document !== null && path !== "_id" && !path.startsWith("_id.");
  const prefix = findPrefix(document?.key ?? "", path, "value");
  // The value holding the current hit wraps instead of being cut off, so the hit is visible.
  const fit = isWithin(current, prefix) ? "whitespace-pre-wrap break-all" : "truncate";

  if (!editable) {
    return (
      <ValueText value={value} mode="shell" className={cn("min-w-0", fit)} findPrefix={prefix} />
    );
  }
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
      className={cn(
        "min-w-0 rounded-sm text-left outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring",
        fit,
      )}
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
      <ValueText
        value={value}
        mode="shell"
        className={fit === "truncate" ? undefined : fit}
        findPrefix={prefix}
      />
    </button>
  );
}
