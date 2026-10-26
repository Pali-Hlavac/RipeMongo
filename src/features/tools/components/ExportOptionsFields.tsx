import { FormField } from "@/shared/ui/form-field";
import { Checkbox, Input, Textarea } from "@/shared/ui/input";

import type { ExportFormErrors, ExportFormValues } from "../lib/export";

interface ExportOptionsFieldsProps {
  values: ExportFormValues;
  errors: ExportFormErrors;
  /** The documents tab had a projection, which exports do not use. */
  projection: boolean;
  onChange: (patch: Partial<ExportFormValues>) => void;
}

/** Options of the chosen format and the query that selects the exported documents. */
export function ExportOptionsFields({
  values,
  errors,
  projection,
  onChange,
}: ExportOptionsFieldsProps) {
  return (
    <>
      {values.format === "json" ? (
        <div className="grid gap-1.5">
          <Checkbox
            label="One JSON array instead of one document per line"
            checked={values.jsonArray}
            onChange={(event) => {
              onChange({ jsonArray: event.target.checked });
            }}
          />
          <Checkbox
            label="Indented, easier to read"
            checked={values.pretty}
            onChange={(event) => {
              onChange({ pretty: event.target.checked });
            }}
          />
          <Checkbox
            label="Keep every type exactly (canonical Extended JSON)"
            checked={values.canonical}
            onChange={(event) => {
              onChange({ canonical: event.target.checked });
            }}
          />
        </div>
      ) : (
        <Checkbox
          label="Field names as the first line"
          checked={values.header}
          onChange={(event) => {
            onChange({ header: event.target.checked });
          }}
        />
      )}
      <FormField
        label="Query filter (optional)"
        description="Only matching documents are exported. Same syntax as the documents filter."
      >
        {(control) => (
          <Textarea
            {...control}
            rows={2}
            spellCheck={false}
            placeholder='{ status: "active" }'
            value={values.filter}
            onChange={(event) => {
              onChange({ filter: event.target.value });
            }}
          />
        )}
      </FormField>
      <div className="grid grid-cols-[2fr_1fr_1fr] gap-2">
        <FormField label="Sort (optional)">
          {(control) => (
            <Input
              {...control}
              className="font-mono"
              spellCheck={false}
              placeholder="{ _id: -1 }"
              value={values.sort}
              onChange={(event) => {
                onChange({ sort: event.target.value });
              }}
            />
          )}
        </FormField>
        <FormField label="Skip" error={errors.skip}>
          {(control) => (
            <Input
              {...control}
              inputMode="numeric"
              placeholder="0"
              value={values.skip}
              onChange={(event) => {
                onChange({ skip: event.target.value });
              }}
            />
          )}
        </FormField>
        <FormField label="Limit" error={errors.limit}>
          {(control) => (
            <Input
              {...control}
              inputMode="numeric"
              placeholder="All"
              value={values.limit}
              onChange={(event) => {
                onChange({ limit: event.target.value });
              }}
            />
          )}
        </FormField>
      </div>
      {projection && (
        <p className="text-xs text-muted-foreground">
          The tab’s projection is not used here; choose the fields above instead.
        </p>
      )}
    </>
  );
}
