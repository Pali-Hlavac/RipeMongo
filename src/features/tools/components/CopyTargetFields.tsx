import { InlineError } from "@/shared/components/InlineError";
import { FormField } from "@/shared/ui/form-field";
import { Input, NativeSelect } from "@/shared/ui/input";

import { useCopyConnections } from "../api/copy";
import type { CopyFormErrors, CopyFormValues } from "../lib/copy";
import type { CopyTarget } from "../store/transfer";

interface CopyTargetFieldsProps {
  target: CopyTarget;
  values: CopyFormValues;
  errors: CopyFormErrors;
  onConnectionChange: (connectionId: string) => void;
  onChange: (patch: Partial<CopyFormValues>) => void;
}

/** Where the copy goes: a saved connection (connected on start) and the names there. */
export function CopyTargetFields({
  target,
  values,
  errors,
  onConnectionChange,
  onChange,
}: CopyTargetFieldsProps) {
  const connections = useCopyConnections();
  const single = target.collection !== null;
  return (
    <>
      <FormField
        label="Copy to connection"
        description="RipeMongo connects to it when the copy starts."
        error={errors.targetConnection ?? null}
      >
        {(control) => (
          <NativeSelect
            {...control}
            value={values.targetConnectionId}
            disabled={!connections.data}
            onChange={(event) => {
              onConnectionChange(event.target.value);
            }}
          >
            {connections.data?.map((connection) => (
              <option key={connection.id} value={connection.id}>
                {connection.id === target.connectionId
                  ? `${connection.name} (the same connection)`
                  : connection.name}
              </option>
            ))}
          </NativeSelect>
        )}
      </FormField>
      {connections.error && <InlineError error={connections.error} />}
      <div className={single ? "grid grid-cols-2 gap-2" : "grid"}>
        <FormField
          label={single ? "Database" : "Database name there"}
          error={errors.database ?? null}
        >
          {(control) => (
            <Input
              {...control}
              className="font-mono"
              spellCheck={false}
              value={values.database}
              onChange={(event) => {
                onChange({ database: event.target.value, namesEdited: true });
              }}
            />
          )}
        </FormField>
        {single && (
          <FormField label="Collection" error={errors.collection ?? null}>
            {(control) => (
              <Input
                {...control}
                className="font-mono"
                spellCheck={false}
                value={values.collection}
                onChange={(event) => {
                  onChange({ collection: event.target.value, namesEdited: true });
                }}
              />
            )}
          </FormField>
        )}
      </div>
    </>
  );
}
