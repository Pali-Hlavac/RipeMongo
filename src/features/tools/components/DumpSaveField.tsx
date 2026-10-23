import { FormField } from "@/shared/ui/form-field";
import { Checkbox, Input } from "@/shared/ui/input";

import type { DumpFormValues } from "../lib/dump";

interface DumpSaveFieldProps {
  values: DumpFormValues;
  /** Editing a saved dump: the name is always shown, without the checkbox. */
  editing: boolean;
  error: string | null;
  onChange: (patch: Partial<DumpFormValues>) => void;
}

/** "Save for one-click re-runs" and the name of the saved dump. */
export function DumpSaveField({ values, editing, error, onChange }: DumpSaveFieldProps) {
  return (
    <div className="grid gap-2 border-t border-border pt-4">
      {!editing && (
        <Checkbox
          label="Save for one-click re-runs"
          checked={values.save}
          onChange={(event) => {
            onChange({ save: event.target.checked });
          }}
        />
      )}
      {values.save && (
        <FormField label="Name" description="Run it again later from Saved dumps." error={error}>
          {(control) => (
            <Input
              {...control}
              maxLength={100}
              value={values.name}
              onChange={(event) => {
                onChange({ name: event.target.value });
              }}
            />
          )}
        </FormField>
      )}
    </div>
  );
}
