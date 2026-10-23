import { HistoryIcon } from "lucide-react";

import { InlineError } from "@/shared/components/InlineError";
import type { DumpContents } from "@/shared/ipc/bindings";
import { Input } from "@/shared/ui/input";

import { databasesOf, namespaceKey, type RestoreFormValues } from "../lib/restore";

interface RestoreContentsFieldProps {
  contents: DumpContents | undefined;
  loading: boolean;
  error: unknown;
  values: RestoreFormValues;
  onChange: (patch: Partial<RestoreFormValues>) => void;
}

/** The dump's databases and collections: tick what to restore and rename databases. */
export function RestoreContentsField({
  contents,
  loading,
  error,
  values,
  onChange,
}: RestoreContentsFieldProps) {
  if (loading) return <p className="text-xs text-muted-foreground">Reading the dump…</p>;
  if (error) return <InlineError error={error} />;
  if (!contents) return null;

  const total = contents.namespaces.length;
  const included = total - values.excluded.length;
  const toggle = (keys: string[], include: boolean) => {
    const others = values.excluded.filter((key) => !keys.includes(key));
    onChange({ excluded: include ? others : [...others, ...keys] });
  };

  return (
    <fieldset className="grid gap-1.5">
      <legend className="mb-1.5 text-sm font-medium">
        What to restore
        <span className="ml-1.5 font-normal text-muted-foreground">
          {included} of {total}
        </span>
      </legend>
      {contents.oplog && (
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <HistoryIcon className="size-3.5" aria-hidden />
          This dump includes an oplog (point-in-time snapshot).
        </p>
      )}
      <div className="grid max-h-56 gap-3 overflow-auto rounded-md border border-border p-2">
        {databasesOf(contents).map(([database, namespaces]) => {
          const keys = namespaces.map(namespaceKey);
          const allIncluded = keys.every((key) => !values.excluded.includes(key));
          return (
            <div key={database} className="grid gap-1">
              <div className="flex items-center gap-2">
                <label className="flex min-w-0 flex-1 items-center gap-2 text-sm font-medium">
                  <input
                    type="checkbox"
                    className="size-4 accent-primary"
                    checked={allIncluded}
                    onChange={(event) => {
                      toggle(keys, event.target.checked);
                    }}
                  />
                  <span className="truncate font-mono">{database}</span>
                </label>
                <Input
                  className="h-7 w-40 font-mono text-xs"
                  aria-label={`Restore ${database} as`}
                  placeholder={`as ${database}`}
                  spellCheck={false}
                  value={values.renames[database] ?? ""}
                  onChange={(event) => {
                    onChange({ renames: { ...values.renames, [database]: event.target.value } });
                  }}
                />
              </div>
              <ul className="grid gap-1 pl-6">
                {namespaces.map((namespace) => {
                  const key = namespaceKey(namespace);
                  return (
                    <li key={key}>
                      <label className="flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          className="size-4 accent-primary"
                          checked={!values.excluded.includes(key)}
                          onChange={(event) => {
                            toggle([key], event.target.checked);
                          }}
                        />
                        <span className="truncate font-mono text-xs">{namespace.collection}</span>
                        {namespace.view && (
                          <span className="text-xs text-muted-foreground">view</span>
                        )}
                      </label>
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
      </div>
      <p className="text-xs text-muted-foreground">
        Type a new name next to a database to restore it as a copy.
      </p>
    </fieldset>
  );
}
