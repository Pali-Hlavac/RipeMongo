import { FormField } from "@/shared/ui/form-field";
import { NativeSelect } from "@/shared/ui/input";

import { emptyToNull } from "../../lib/auth";
import type { ReadPreferenceMode } from "../../types";
import { OptionsEditor } from "./OptionsEditor";
import { TextField } from "./TextField";
import type { SectionProps } from "./section";

const READ_PREFERENCES: readonly { value: ReadPreferenceMode; label: string }[] = [
  { value: "primary", label: "Primary" },
  { value: "primaryPreferred", label: "Primary preferred" },
  { value: "secondary", label: "Secondary" },
  { value: "secondaryPreferred", label: "Secondary preferred" },
  { value: "nearest", label: "Nearest" },
];

const DIRECT_OPTIONS = { auto: null, yes: true, no: false } as const;
type DirectOption = keyof typeof DIRECT_OPTIONS;

function directOptionOf(value: boolean | null): DirectOption {
  if (value === null) return "auto";
  return value ? "yes" : "no";
}

/** Replica set, read preference, direct connection, app name and free-form options. */
export function AdvancedTab({ draft }: SectionProps) {
  const { profile, updateConfig } = draft;
  const { config } = profile;

  return (
    <div className="grid gap-4">
      <div className="grid grid-cols-2 gap-4">
        <TextField
          label="Replica set name"
          value={config.replicaSet ?? ""}
          onChange={(value) => {
            updateConfig({ replicaSet: emptyToNull(value) });
          }}
        />
        <FormField label="Read preference">
          {(control) => (
            <NativeSelect
              {...control}
              value={config.readPreference ?? ""}
              onChange={(event) => {
                const mode = READ_PREFERENCES.find((option) => option.value === event.target.value);
                updateConfig({ readPreference: mode?.value ?? null });
              }}
            >
              <option value="">Default (primary)</option>
              {READ_PREFERENCES.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </NativeSelect>
          )}
        </FormField>
        <FormField
          label="Direct connection"
          description="Yes connects only to the listed host, without discovering the replica set."
        >
          {(control) => (
            <NativeSelect
              {...control}
              disabled={config.scheme === "srv"}
              value={directOptionOf(config.directConnection)}
              onChange={(event) => {
                updateConfig({
                  directConnection: DIRECT_OPTIONS[event.target.value as DirectOption],
                });
              }}
            >
              <option value="auto">Automatic</option>
              <option value="yes">Yes</option>
              <option value="no">No</option>
            </NativeSelect>
          )}
        </FormField>
        <TextField
          label="Default database"
          value={config.defaultDatabase ?? ""}
          onChange={(value) => {
            updateConfig({ defaultDatabase: emptyToNull(value) });
          }}
        />
        <TextField
          label="Application name"
          placeholder="RipeMongo"
          value={config.appName ?? ""}
          onChange={(value) => {
            updateConfig({ appName: emptyToNull(value) });
          }}
        />
      </div>
      <OptionsEditor
        options={config.extraOptions}
        onChange={(extraOptions) => {
          updateConfig({ extraOptions });
        }}
      />
    </div>
  );
}
