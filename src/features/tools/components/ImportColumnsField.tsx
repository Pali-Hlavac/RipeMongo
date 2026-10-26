import type { ColumnType, ImportPreview } from "@/shared/ipc/bindings";
import { Input, NativeSelect } from "@/shared/ui/input";

import { importColumns, type ColumnValues, type ImportFormValues } from "../lib/import";

/** Column types in the order offered, with plain names. */
const TYPE_LABELS: Record<ColumnType, string> = {
  auto: "Automatic",
  string: "Text",
  int32: "Whole number (32-bit)",
  int64: "Whole number (64-bit)",
  double: "Decimal number",
  decimal: "Exact decimal (Decimal128)",
  boolean: "True / false",
  isoDate: "Date, ISO 8601 with time zone",
  isoLocalDate: "Date, ISO 8601 without zone (UTC)",
  date: "Date in another format",
  base64: "Binary (base64)",
  hex: "Binary (hex)",
};

interface ImportColumnsFieldProps {
  preview: ImportPreview;
  values: ImportFormValues;
  error: string | null;
  onChange: (patch: Partial<ImportFormValues>) => void;
}

/** Which CSV columns are imported, under which field names and as which types. */
export function ImportColumnsField({ preview, values, error, onChange }: ImportColumnsFieldProps) {
  const columns = importColumns(preview, values);
  const included = columns.filter((column) => column.include).length;
  const edit = (index: number, patch: Partial<ColumnValues>) => {
    onChange({
      columnEdits: { ...values.columnEdits, [index]: { ...values.columnEdits[index], ...patch } },
    });
  };

  return (
    <fieldset className="grid gap-1.5">
      <legend className="mb-1.5 text-sm font-medium">
        Columns
        <span className="ml-1.5 font-normal text-muted-foreground">
          {included} of {columns.length} imported
        </span>
      </legend>
      <ul className="grid max-h-72 gap-2 overflow-auto rounded-md border border-border p-2">
        {columns.map((column, index) => {
          const first = preview.columns[index]?.first.trim() ?? "";
          const name = first === "" ? `column ${index + 1}` : first;
          const samples = preview.columns[index]?.samples.filter((sample) => sample !== "");
          return (
            <li key={index} className="grid gap-1">
              <div className="grid grid-cols-[auto_1fr_1fr] items-center gap-2">
                <input
                  type="checkbox"
                  className="size-4 accent-primary"
                  aria-label={`Import column ${name}`}
                  checked={column.include}
                  onChange={(event) => {
                    edit(index, { include: event.target.checked });
                  }}
                />
                <Input
                  className="h-8 font-mono text-xs"
                  aria-label={`Field name for column ${name}`}
                  spellCheck={false}
                  disabled={!column.include}
                  value={column.field}
                  onChange={(event) => {
                    edit(index, { field: event.target.value });
                  }}
                />
                <NativeSelect
                  className="h-8 text-xs"
                  aria-label={`Type of column ${name}`}
                  disabled={!column.include}
                  value={column.type}
                  onChange={(event) => {
                    edit(index, { type: event.target.value as ColumnType });
                  }}
                >
                  {Object.entries(TYPE_LABELS).map(([type, label]) => (
                    <option key={type} value={type}>
                      {label}
                    </option>
                  ))}
                </NativeSelect>
              </div>
              {column.include && column.type === "date" && (
                <Input
                  className="ml-6 h-8 w-[calc(100%-1.5rem)] font-mono text-xs"
                  aria-label={`Date format of column ${name}`}
                  spellCheck={false}
                  placeholder="dd.MM.yyyy HH:mm"
                  value={column.dateFormat}
                  onChange={(event) => {
                    edit(index, { dateFormat: event.target.value });
                  }}
                />
              )}
              <p className="ml-6 truncate text-xs text-muted-foreground">
                {samples && samples.length > 0 ? `e.g. ${samples.join(" · ")}` : "No values seen"}
              </p>
            </li>
          );
        })}
      </ul>
      <p className="text-xs text-muted-foreground">
        A dot in a field name creates a nested document (address.city). Dates in another format use
        yyyy, MM, dd, HH, mm and ss, for example dd.MM.yyyy.
      </p>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </fieldset>
  );
}
