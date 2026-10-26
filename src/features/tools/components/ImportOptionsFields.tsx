import type { ReactNode } from "react";

import type { ImportMode, ImportPreview, ParseErrors } from "@/shared/ipc/bindings";
import { FormField } from "@/shared/ui/form-field";
import { Checkbox, Input, NativeSelect } from "@/shared/ui/input";

import type { ImportFormValues } from "../lib/import";

const DELIMITERS: Record<string, string> = {
  ",": "Comma ( , )",
  ";": "Semicolon ( ; )",
  "\t": "Tab",
  "|": "Vertical bar ( | )",
};

const PARSE_ERRORS: Record<ParseErrors, string> = {
  stop: "Stop the import",
  skipField: "Leave that field out",
  skipRow: "Leave that row out",
  autoCast: "Import it as Automatic",
};

const MODES: Record<ImportMode, string> = {
  insert: "Insert only: skip documents whose _id exists",
  upsert: "Replace matching documents, insert the rest",
  merge: "Update fields of matching documents, insert the rest",
};

interface ImportCsvFieldsProps {
  preview: ImportPreview;
  values: ImportFormValues;
  onDelimiterChange: (delimiter: string) => void;
  onChange: (patch: Partial<ImportFormValues>) => void;
  /** The column mapping, shown right after the delimiter and header line. */
  children: ReactNode;
}

/** How a text file is read: delimiter, header line, columns, empty values and type errors. */
export function ImportCsvFields({
  preview,
  values,
  onDelimiterChange,
  onChange,
  children,
}: ImportCsvFieldsProps) {
  const delimiters =
    preview.delimiter in DELIMITERS
      ? DELIMITERS
      : { ...DELIMITERS, [preview.delimiter]: `“${preview.delimiter}”` };
  return (
    <>
      <div className="grid grid-cols-2 items-end gap-2">
        <FormField label="Values separated by">
          {(control) => (
            <NativeSelect
              {...control}
              value={preview.delimiter}
              onChange={(event) => {
                onDelimiterChange(event.target.value);
              }}
            >
              {Object.entries(delimiters).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </NativeSelect>
          )}
        </FormField>
        <Checkbox
          className="h-9"
          label="First line has column names"
          checked={values.header}
          onChange={(event) => {
            onChange({ header: event.target.checked });
          }}
        />
      </div>
      {children}
      <Checkbox
        label="Leave out fields whose value is empty"
        checked={values.ignoreBlanks}
        onChange={(event) => {
          onChange({ ignoreBlanks: event.target.checked });
        }}
      />
      <FormField label="When a value does not fit its type">
        {(control) => (
          <NativeSelect
            {...control}
            value={values.parseErrors}
            onChange={(event) => {
              onChange({ parseErrors: event.target.value as ParseErrors });
            }}
          >
            {Object.entries(PARSE_ERRORS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </NativeSelect>
        )}
      </FormField>
    </>
  );
}

interface ImportOptionsFieldsProps {
  values: ImportFormValues;
  onChange: (patch: Partial<ImportFormValues>) => void;
}

/** What happens to existing documents, errors, and dropping the collection first. */
export function ImportOptionsFields({ values, onChange }: ImportOptionsFieldsProps) {
  return (
    <>
      <FormField label="Existing documents">
        {(control) => (
          <NativeSelect
            {...control}
            value={values.mode}
            onChange={(event) => {
              onChange({ mode: event.target.value as ImportMode });
            }}
          >
            {Object.entries(MODES).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </NativeSelect>
        )}
      </FormField>
      {values.mode !== "insert" && (
        <FormField
          label="Match documents on"
          description="Comma-separated fields that identify a document; empty uses _id."
        >
          {(control) => (
            <Input
              {...control}
              className="font-mono"
              spellCheck={false}
              placeholder="_id"
              value={values.matchFields}
              onChange={(event) => {
                onChange({ matchFields: event.target.value });
              }}
            />
          )}
        </FormField>
      )}
      <Checkbox
        label="Stop at the first document that cannot be imported"
        checked={values.stopOnError}
        onChange={(event) => {
          onChange({ stopOnError: event.target.checked });
        }}
      />
      <div className="grid gap-1">
        <Checkbox
          label="Drop the collection first"
          checked={values.drop}
          onChange={(event) => {
            onChange({ drop: event.target.checked });
          }}
        />
        <p className="pl-6 text-xs text-muted-foreground">
          Deletes every document and index of the collection before importing. You confirm by typing
          its name.
        </p>
      </div>
    </>
  );
}
