import { FormField } from "@/shared/ui/form-field";
import { Checkbox, Input } from "@/shared/ui/input";

import { DEFAULT_PARALLEL_COLLECTIONS, MAX_PARALLEL_COLLECTIONS } from "../lib/dump";
import type { RestoreFormValues } from "../lib/restore";

interface RestoreOptionsFieldsProps {
  values: RestoreFormValues;
  /** The dump has an oplog. */
  hasOplog: boolean;
  /** Everything is restored under its own name, so the oplog can be replayed. */
  canReplay: boolean;
  parallelError: string | null;
  onChange: (patch: Partial<RestoreFormValues>) => void;
}

function Option({
  description,
  ...props
}: Parameters<typeof Checkbox>[0] & { description: string }) {
  return (
    <div className="grid gap-1">
      <Checkbox {...props} />
      <p className="pl-6 text-xs text-muted-foreground">{description}</p>
    </div>
  );
}

/** Drop, dry run, oplog replay and parallelism. */
export function RestoreOptionsFields({
  values,
  hasOplog,
  canReplay,
  parallelError,
  onChange,
}: RestoreOptionsFieldsProps) {
  return (
    <>
      <Option
        label="Drop each collection before restoring it"
        description="Replaces collections that already exist. Without it, documents whose _id already exists are skipped and reported."
        checked={values.drop}
        onChange={(event) => {
          onChange({ drop: event.target.checked });
        }}
      />
      {hasOplog && (
        <Option
          label="Replay the oplog (point-in-time)"
          description={
            canReplay
              ? "Also applies the changes recorded while the dump ran."
              : "Only possible when everything is restored under its own name."
          }
          disabled={!canReplay}
          checked={canReplay && values.oplogReplay}
          onChange={(event) => {
            onChange({ oplogReplay: event.target.checked });
          }}
        />
      )}
      <Option
        label="Dry run"
        description="Only checks the dump and lists what would be restored. Nothing is written."
        checked={values.dryRun}
        onChange={(event) => {
          onChange({ dryRun: event.target.checked });
        }}
      />
      <FormField
        label="Collections at a time"
        description={`How many collections are restored in parallel (1–${MAX_PARALLEL_COLLECTIONS}).`}
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
    </>
  );
}
