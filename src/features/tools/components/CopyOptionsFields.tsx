import { FormField } from "@/shared/ui/form-field";
import { Checkbox, Input } from "@/shared/ui/input";

import type { CopyFormValues } from "../lib/copy";
import type { CopyTarget } from "../store/transfer";
import { DumpCollectionsField } from "./DumpCollectionsField";

interface CopyOptionsFieldsProps {
  target: CopyTarget;
  values: CopyFormValues;
  onChange: (patch: Partial<CopyFormValues>) => void;
}

/** What is copied (a query, or the collections of a database), indexes and replacing. */
export function CopyOptionsFields({ target, values, onChange }: CopyOptionsFieldsProps) {
  const single = target.collection !== null;
  return (
    <>
      {single ? (
        <FormField
          label="Only documents matching"
          description="A query filter, for example { status: 'paid' }. Empty copies every document."
        >
          {(control) => (
            <Input
              {...control}
              className="font-mono"
              spellCheck={false}
              placeholder="{ }"
              value={values.query}
              onChange={(event) => {
                onChange({ query: event.target.value });
              }}
            />
          )}
        </FormField>
      ) : (
        <DumpCollectionsField
          connectionId={target.connectionId}
          database={target.database}
          excluded={values.excluded}
          prefixes={values.prefixes}
          onChange={onChange}
        />
      )}
      <Checkbox
        label="Copy indexes"
        checked={values.indexes}
        onChange={(event) => {
          onChange({ indexes: event.target.checked });
        }}
      />
      <div className="grid gap-1">
        <Checkbox
          label={single ? "Replace the collection if it exists" : "Replace collections that exist"}
          checked={values.drop}
          onChange={(event) => {
            onChange({ drop: event.target.checked });
          }}
        />
        <p className="pl-6 text-xs text-muted-foreground">
          {single
            ? "Deletes the target collection with its documents and indexes first."
            : "Deletes each copied collection in the target database first; other collections there stay."}{" "}
          You confirm by typing its name. Otherwise documents are added, and those whose _id already
          exists are skipped.
        </p>
      </div>
    </>
  );
}
