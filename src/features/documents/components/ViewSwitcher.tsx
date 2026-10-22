import { BracesIcon, ListTreeIcon, Table2Icon, type LucideIcon } from "lucide-react";

import { cn } from "@/shared/lib/cn";

import type { DocumentView } from "../store/view";

const VIEWS: { value: DocumentView; label: string; icon: LucideIcon }[] = [
  { value: "list", label: "List", icon: ListTreeIcon },
  { value: "json", label: "JSON", icon: BracesIcon },
  { value: "table", label: "Table", icon: Table2Icon },
];

/** Segmented control choosing how documents are shown. */
export function ViewSwitcher({
  value,
  onChange,
}: {
  value: DocumentView;
  onChange: (view: DocumentView) => void;
}) {
  return (
    <div
      role="radiogroup"
      aria-label="Document view"
      className="flex gap-0.5 rounded-md bg-muted p-0.5"
    >
      {VIEWS.map(({ value: view, label, icon: Icon }) => (
        <button
          key={view}
          type="button"
          role="radio"
          aria-checked={value === view}
          className={cn(
            "flex items-center gap-1.5 rounded-sm px-2 py-0.5 text-xs text-muted-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring",
            value === view && "bg-background text-foreground shadow-sm",
          )}
          onClick={() => {
            onChange(view);
          }}
        >
          <Icon className="size-3.5" aria-hidden />
          {label}
        </button>
      ))}
    </div>
  );
}
