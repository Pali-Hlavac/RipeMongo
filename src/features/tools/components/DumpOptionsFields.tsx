import { FormField } from "@/shared/ui/form-field";
import { Checkbox, Input, Textarea } from "@/shared/ui/input";

import {
  DEFAULT_PARALLEL_COLLECTIONS,
  MAX_PARALLEL_COLLECTIONS,
  type DumpFormValues,
  type DumpScope,
} from "../lib/dump";
import type { DumpTarget } from "../store/dump";
import { DumpCollectionsField } from "./DumpCollectionsField";

interface DumpOptionsFieldsProps {
  target: DumpTarget;
  scope: DumpScope;
  values: DumpFormValues;
  parallelError: string | null;
  onChange: (patch: Partial<DumpFormValues>) => void;
}

/** Gzip plus the options that apply to the dump's scope (server, database or collection). */
export function DumpOptionsFields({
  target,
  scope,
  values,
  parallelError,
  onChange,
}: DumpOptionsFieldsProps) {
  return (
    <>
      {scope === "collection" && (
        <FormField
          label="Query filter (optional)"
          description="Only matching documents are dumped. Same syntax as the documents filter."
        >
          {(control) => (
            <Textarea
              {...control}
              rows={2}
              spellCheck={false}
              placeholder='{ status: "active" }'
              value={values.query}
              onChange={(event) => {
                onChange({ query: event.target.value });
              }}
            />
          )}
        </FormField>
      )}
      {scope === "database" && target.database !== null && (
        <DumpCollectionsField
          connectionId={target.connectionId}
          database={target.database}
          excluded={values.excluded}
          prefixes={values.prefixes}
          onChange={onChange}
        />
      )}
      <Checkbox
        label="Compress with gzip"
        checked={values.gzip}
        onChange={(event) => {
          onChange({ gzip: event.target.checked });
        }}
      />
      {scope === "server" && (
        <div className="grid gap-1">
          <Checkbox
            label="Point-in-time snapshot (oplog)"
            checked={values.oplog}
            onChange={(event) => {
              onChange({ oplog: event.target.checked });
            }}
          />
          <p className="pl-6 text-xs text-muted-foreground">
            Replica sets only. Also saves changes made while the dump runs, so a restore is
            consistent.
          </p>
        </div>
      )}
      {scope !== "collection" && (
        <FormField
          label="Collections at a time"
          description={`How many collections are dumped in parallel (1–${MAX_PARALLEL_COLLECTIONS}). Fewer puts less load on the server.`}
          error={parallelError}
        >
          {(control) => (
            <Input
              {...control}
              className="w-32"
              type="number"
              inputMode="numeric"
              min={1}
              max={MAX_PARALLEL_COLLECTIONS}
              placeholder={`${DEFAULT_PARALLEL_COLLECTIONS} (default)`}
              value={values.parallel}
              onChange={(event) => {
                onChange({ parallel: event.target.value });
              }}
            />
          )}
        </FormField>
      )}
    </>
  );
}
