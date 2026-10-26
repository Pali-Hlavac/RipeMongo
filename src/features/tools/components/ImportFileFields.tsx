import { InlineError } from "@/shared/components/InlineError";
import type { ImportFormat, ImportPreview } from "@/shared/ipc/bindings";
import { formatBytes } from "@/shared/lib/format";
import { FormField } from "@/shared/ui/form-field";
import { Input } from "@/shared/ui/input";

import type { ImportFormErrors, ImportFormValues } from "../lib/import";
import { PathField } from "./PathField";

const FORMAT_NAMES: Record<ImportFormat, string> = {
  json: "JSON, one document per line",
  jsonArray: "JSON array",
  csv: "Text with columns (CSV)",
};

interface ImportFileFieldsProps {
  values: ImportFormValues;
  errors: ImportFormErrors;
  /** Importing into a new collection named here. */
  creating: boolean;
  preview: ImportPreview | undefined;
  loading: boolean;
  previewError: Error | null;
  onChange: (patch: Partial<ImportFormValues>) => void;
  /** Reads the typed path (when the user leaves the field). */
  onCommit: () => void;
  onBrowse: () => void;
}

/** The file to import, what RipeMongo found in it and, for a new collection, its name. */
export function ImportFileFields({
  values,
  errors,
  creating,
  preview,
  loading,
  previewError,
  onChange,
  onCommit,
  onBrowse,
}: ImportFileFieldsProps) {
  return (
    <>
      <PathField
        label="File"
        path={values.path}
        placeholder="Choose a JSON or CSV file…"
        error={errors.path ?? null}
        onChange={(path) => {
          onChange({ path });
        }}
        onCommit={onCommit}
        onBrowse={onBrowse}
      />
      {loading && <p className="text-xs text-muted-foreground">Reading the file…</p>}
      {previewError && <InlineError error={previewError} />}
      {preview && (
        <p className="text-sm">
          {FORMAT_NAMES[preview.format]}
          <span className="text-muted-foreground"> · {formatBytes(preview.size ?? 0)}</span>
        </p>
      )}
      {creating && (
        <FormField
          label="New collection"
          description="Created by the import. Suggested from the file name."
          error={errors.collection}
        >
          {(control) => (
            <Input
              {...control}
              className="font-mono"
              spellCheck={false}
              value={values.collection}
              onChange={(event) => {
                onChange({ collection: event.target.value, collectionEdited: true });
              }}
            />
          )}
        </FormField>
      )}
    </>
  );
}
