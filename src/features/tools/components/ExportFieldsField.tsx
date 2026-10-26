import { InlineError } from "@/shared/components/InlineError";
import { Button } from "@/shared/ui/button";
import { FormField } from "@/shared/ui/form-field";
import { Input } from "@/shared/ui/input";

import type { ExportFormValues } from "../lib/export";

interface ExportFieldsFieldProps {
  values: ExportFormValues;
  /** Sampled names for the current format; `undefined` while loading. */
  sampled: string[] | undefined;
  loadError: Error | null;
  error: string | null;
  onChange: (patch: Partial<ExportFormValues>) => void;
}

const HINTS = {
  json: "With every field ticked, whole documents are exported, including fields the sample missed.",
  csv: "Each ticked field becomes a column. Arrays and nested documents are written as JSON.",
};

/** Which fields an export writes: a checklist from a sample of documents plus typed names. */
export function ExportFieldsField({
  values,
  sampled,
  loadError,
  error,
  onChange,
}: ExportFieldsFieldProps) {
  const ticked = sampled?.filter((field) => !values.unticked.includes(field)).length ?? 0;
  const toggle = (field: string, checked: boolean) => {
    onChange({
      unticked: checked
        ? values.unticked.filter((item) => item !== field)
        : [...values.unticked, field],
    });
  };

  return (
    <>
      <fieldset className="grid gap-1.5">
        <legend className="mb-1.5 flex w-full items-center justify-between text-sm font-medium">
          <span>
            {values.format === "csv" ? "Columns" : "Fields"}
            {sampled && (
              <span className="ml-1.5 font-normal text-muted-foreground">
                {ticked} of {sampled.length}
              </span>
            )}
          </span>
          {sampled && sampled.length > 0 && (
            <span className="flex gap-1">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  onChange({ unticked: values.unticked.filter((name) => !sampled.includes(name)) });
                }}
              >
                All
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  onChange({ unticked: [...new Set([...values.unticked, ...sampled])] });
                }}
              >
                None
              </Button>
            </span>
          )}
        </legend>
        {!sampled && !loadError && (
          <p className="text-xs text-muted-foreground">Reading a sample of documents…</p>
        )}
        {loadError && <InlineError error={loadError} />}
        {sampled?.length === 0 && (
          <p className="text-xs text-muted-foreground">No documents to read field names from.</p>
        )}
        {sampled && sampled.length > 0 && (
          <ul className="grid max-h-40 gap-1 overflow-auto rounded-md border border-border p-2">
            {sampled.map((field) => (
              <li key={field}>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    className="size-4 accent-primary"
                    checked={!values.unticked.includes(field)}
                    onChange={(event) => {
                      toggle(field, event.target.checked);
                    }}
                  />
                  <span className="truncate font-mono text-xs">{field}</span>
                </label>
              </li>
            ))}
          </ul>
        )}
        <p className="text-xs text-muted-foreground">{HINTS[values.format]}</p>
        {error && <p className="text-xs text-destructive">{error}</p>}
      </fieldset>
      <FormField
        label="Other fields"
        description="Comma-separated names the sample did not find, for example notes, address.zip"
      >
        {(control) => (
          <Input
            {...control}
            className="font-mono"
            spellCheck={false}
            value={values.extraFields}
            onChange={(event) => {
              onChange({ extraFields: event.target.value });
            }}
          />
        )}
      </FormField>
    </>
  );
}
