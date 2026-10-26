import { AlertTriangleIcon } from "lucide-react";
import { useId } from "react";

import { FormField } from "@/shared/ui/form-field";
import { Checkbox, Input } from "@/shared/ui/input";

import { MAX_INSERTION_WORKERS, type ImportFormValues } from "../lib/import";

interface ImportSpeedFieldsProps {
  values: ImportFormValues;
  workersError: string | null;
  onChange: (patch: Partial<ImportFormValues>) => void;
}

/** Options that make a large import faster: parallel insert workers, skipping validation. */
export function ImportSpeedFields({ values, workersError, onChange }: ImportSpeedFieldsProps) {
  const warningId = useId();
  return (
    <>
      <FormField
        label="Insert workers"
        description={`How many batches of documents are inserted at the same time (1–${MAX_INSERTION_WORKERS}). More can be faster on a strong server but puts more load on it, and documents no longer arrive in file order.`}
        error={workersError}
      >
        {(control) => (
          <Input
            {...control}
            className="w-32"
            type="number"
            inputMode="numeric"
            min={1}
            max={MAX_INSERTION_WORKERS}
            placeholder="1 (default)"
            value={values.workers}
            onChange={(event) => {
              onChange({ workers: event.target.value });
            }}
          />
        )}
      </FormField>
      <div className="grid gap-1">
        <Checkbox
          label="Skip validation rules"
          checked={values.bypassValidation}
          aria-describedby={warningId}
          onChange={(event) => {
            onChange({ bypassValidation: event.target.checked });
          }}
        />
        <p id={warningId} className="pl-6 text-xs text-muted-foreground">
          Imports documents even when they break the collection&apos;s validation rules. Your user
          needs the permission to bypass validation.
        </p>
        {values.bypassValidation && (
          <p className="flex items-start gap-1.5 pl-6 text-xs text-destructive">
            <AlertTriangleIcon className="mt-px size-3.5 shrink-0" aria-hidden />
            Documents the rules would reject end up in the collection, and apps that rely on the
            rules may not handle them. Use it only for data you trust.
          </p>
        )}
      </div>
    </>
  );
}
