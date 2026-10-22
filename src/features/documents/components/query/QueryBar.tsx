import { SearchIcon, SlidersHorizontalIcon } from "lucide-react";
import { useId, useState, type ReactNode } from "react";

import { InlineError } from "@/shared/components/InlineError";
import { toIpcError } from "@/shared/ipc/client";
import { cn } from "@/shared/lib/cn";
import { Button } from "@/shared/ui/button";
import { fieldClassName } from "@/shared/ui/input";

import type { CollectionTarget } from "../../api/keys";
import type { QueryPart } from "../../lib/completion";
import { EMPTY_QUERY, type AppliedQuery } from "../../store/view";
import { QueryHistoryMenu } from "./QueryHistoryMenu";
import { QueryInput } from "./QueryInput";

/** Numeric options; 0 is shown as empty ("none"). */
const NUMBER_OPTIONS: {
  key: "skip" | "limit" | "maxTimeMs";
  label: string;
  step: number;
  placeholder: string;
}[] = [
  { key: "skip", label: "Skip", step: 1, placeholder: "0" },
  { key: "limit", label: "Limit", step: 1, placeholder: "No limit" },
  { key: "maxTimeMs", label: "Max time (ms)", step: 1000, placeholder: "No limit" },
];

const OPTION_PARTS: { part: Exclude<QueryPart, "filter">; label: string; placeholder: string }[] = [
  { part: "projection", label: "Project", placeholder: "{ name: 1, _id: 0 }" },
  { part: "sort", label: "Sort", placeholder: "{ createdAt: -1 }" },
  { part: "collation", label: "Collation", placeholder: '{ locale: "en", strength: 2 }' },
];

/** The query part a backend error names ("Filter: …"), if any. */
function invalidPart(error: unknown): QueryPart | null {
  if (!error) return null;
  const message = toIpcError(error).message.toLowerCase();
  return (
    (["filter", "projection", "sort", "collation"] as const).find((part) =>
      message.startsWith(`${part}:`),
    ) ?? null
  );
}

interface QueryBarProps {
  target: CollectionTarget;
  applied: AppliedQuery;
  onApply: (query: AppliedQuery) => void;
  /** Field paths of the loaded documents, for autocomplete. */
  fields: readonly string[];
  /** A rejected query (`INVALID_INPUT`), shown under the bar. */
  error: unknown;
}

/** Filter plus optional projection / sort / collation / time limit; Enter or Find applies. */
export function QueryBar({ target, applied, onApply, fields, error }: QueryBarProps) {
  const ids = { filter: useId(), maxTime: useId(), error: useId() };
  const [draft, setDraft] = useState(applied);
  const [showOptions, setShowOptions] = useState(false);
  // Take over queries applied from elsewhere (history, reset) without an effect.
  const [lastApplied, setLastApplied] = useState(applied);
  if (lastApplied !== applied) {
    setLastApplied(applied);
    setDraft(applied);
  }
  const bad = invalidPart(error);
  const optionsActive =
    OPTION_PARTS.some(({ part }) => applied[part].trim() !== "") ||
    applied.skip > 0 ||
    applied.limit > 0;
  const set = (patch: Partial<AppliedQuery>) => {
    setDraft((current) => ({ ...current, ...patch }));
  };

  return (
    <form
      role="search"
      aria-label="Query"
      className="grid gap-2 border-b border-border px-4 py-2"
      onSubmit={(event) => {
        event.preventDefault();
        onApply(draft);
      }}
    >
      <div className="flex items-center gap-2">
        <label htmlFor={ids.filter} className="text-sm font-medium">
          Filter
        </label>
        <QueryInput
          id={ids.filter}
          part="filter"
          className="flex-1"
          placeholder='{ status: "active" }  —  Ctrl+Space for suggestions'
          value={draft.filter}
          fields={fields}
          invalid={bad === "filter"}
          aria-describedby={error ? ids.error : undefined}
          onChange={(filter) => {
            set({ filter });
          }}
        />
        <Button
          type="button"
          variant="ghost"
          size="sm"
          aria-expanded={showOptions || (bad !== null && bad !== "filter")}
          className={cn(optionsActive && "text-primary")}
          onClick={() => {
            setShowOptions((open) => !open);
          }}
        >
          <SlidersHorizontalIcon aria-hidden /> Options
        </Button>
        <QueryHistoryMenu target={target} draft={draft} onPick={onApply} />
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => {
            onApply({ ...EMPTY_QUERY, maxTimeMs: draft.maxTimeMs });
          }}
        >
          Reset
        </Button>
        <Button type="submit" size="sm">
          <SearchIcon aria-hidden /> Find
        </Button>
      </div>
      {(showOptions || (bad !== null && bad !== "filter")) && (
        <div className="grid grid-cols-3 gap-2">
          {OPTION_PARTS.map(({ part, label, placeholder }) => (
            <OptionField key={part} label={label}>
              {(id) => (
                <QueryInput
                  id={id}
                  part={part}
                  placeholder={placeholder}
                  value={draft[part]}
                  fields={fields}
                  invalid={bad === part}
                  onChange={(value) => {
                    set({ [part]: value });
                  }}
                />
              )}
            </OptionField>
          ))}
          {NUMBER_OPTIONS.map(({ key, label, step, placeholder }) => (
            <OptionField key={key} label={label}>
              {(id) => (
                <input
                  id={id}
                  type="number"
                  min={0}
                  step={step}
                  placeholder={placeholder}
                  className={cn(fieldClassName, "h-8")}
                  value={draft[key] === 0 ? "" : draft[key]}
                  onChange={(event) => {
                    const value = Math.round(Number(event.target.value));
                    set({ [key]: Number.isFinite(value) && value > 0 ? value : 0 });
                  }}
                />
              )}
            </OptionField>
          ))}
        </div>
      )}
      {error ? (
        <div id={ids.error}>
          <InlineError error={error} />
        </div>
      ) : null}
    </form>
  );
}

function OptionField({ label, children }: { label: string; children: (id: string) => ReactNode }) {
  const id = useId();
  return (
    <div className="grid gap-1">
      <label htmlFor={id} className="text-xs font-medium text-muted-foreground">
        {label}
      </label>
      {children(id)}
    </div>
  );
}
