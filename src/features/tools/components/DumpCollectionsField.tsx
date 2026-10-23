import { InlineError } from "@/shared/components/InlineError";
import { Button } from "@/shared/ui/button";
import { FormField } from "@/shared/ui/form-field";
import { Input } from "@/shared/ui/input";

import { useDumpCollections } from "../api/dump";
import type { DumpFormValues } from "../lib/dump";

interface DumpCollectionsFieldProps {
  connectionId: string;
  database: string;
  excluded: string[];
  prefixes: string;
  onChange: (patch: Partial<DumpFormValues>) => void;
}

/**
 * Which collections a database dump includes: a checklist (unticked ones are left out, so
 * collections created later are included) and name prefixes to leave out.
 */
export function DumpCollectionsField({
  connectionId,
  database,
  excluded,
  prefixes,
  onChange,
}: DumpCollectionsFieldProps) {
  const { data: collections, error, isPending } = useDumpCollections(connectionId, database);
  const included = collections?.filter((name) => !excluded.includes(name)).length ?? 0;
  const toggle = (name: string, checked: boolean) => {
    onChange({
      excluded: checked ? excluded.filter((item) => item !== name) : [...excluded, name],
    });
  };

  return (
    <>
      <fieldset className="grid gap-1.5">
        <legend className="mb-1.5 flex w-full items-center justify-between text-sm font-medium">
          <span>
            Collections
            {collections && (
              <span className="ml-1.5 font-normal text-muted-foreground">
                {included} of {collections.length}
              </span>
            )}
          </span>
          {collections && collections.length > 0 && (
            <span className="flex gap-1">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  onChange({ excluded: excluded.filter((name) => !collections.includes(name)) });
                }}
              >
                All
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  onChange({ excluded: [...new Set([...excluded, ...collections])] });
                }}
              >
                None
              </Button>
            </span>
          )}
        </legend>
        {isPending && <p className="text-xs text-muted-foreground">Loading collections…</p>}
        {error && <InlineError error={error} />}
        {collections?.length === 0 && (
          <p className="text-xs text-muted-foreground">This database has no collections yet.</p>
        )}
        {collections && collections.length > 0 && (
          <ul className="grid max-h-36 gap-1 overflow-auto rounded-md border border-border p-2">
            {collections.map((name) => (
              <li key={name}>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    className="size-4 accent-primary"
                    checked={!excluded.includes(name)}
                    onChange={(event) => {
                      toggle(name, event.target.checked);
                    }}
                  />
                  <span className="truncate font-mono text-xs">{name}</span>
                </label>
              </li>
            ))}
          </ul>
        )}
      </fieldset>
      <FormField
        label="Also leave out names starting with"
        description="Comma-separated, for example tmp_, cache_"
      >
        {(control) => (
          <Input
            {...control}
            className="font-mono"
            spellCheck={false}
            value={prefixes}
            onChange={(event) => {
              onChange({ prefixes: event.target.value });
            }}
          />
        )}
      </FormField>
    </>
  );
}
