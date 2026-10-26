import type {
  ColumnType,
  ImportMode,
  ImportPreview,
  ImportRequest,
  ParseErrors,
} from "@/shared/ipc/bindings";

import type { ImportTarget } from "../store/transfer";

/** Date layout offered when a column becomes a date without a suggested one. */
export const DEFAULT_DATE_FORMAT = "yyyy-MM-dd";

/** How one CSV column is imported. */
export interface ColumnValues {
  include: boolean;
  field: string;
  type: ColumnType;
  dateFormat: string;
}

/** Everything the import dialog edits. */
export interface ImportFormValues {
  path: string;
  /** Collection name; edited only when importing into a new collection. */
  collection: string;
  /** The user typed a collection name (stops it following the file name). */
  collectionEdited: boolean;
  header: boolean;
  /**
   * Changes to the columns found in the file, by index. Kept apart from the file preview
   * (server data) and dropped when another file or delimiter is read.
   */
  columnEdits: Record<number, Partial<ColumnValues> | undefined>;
  ignoreBlanks: boolean;
  parseErrors: ParseErrors;
  mode: ImportMode;
  /** Comma-separated; empty matches on `_id`. */
  matchFields: string;
  drop: boolean;
  stopOnError: boolean;
}

export function initialImportValues(target: ImportTarget): ImportFormValues {
  return {
    path: "",
    collection: target.collection ?? "",
    collectionEdited: false,
    header: true,
    columnEdits: {},
    ignoreBlanks: false,
    parseErrors: "stop",
    mode: "insert",
    matchFields: "",
    drop: false,
    stopOnError: false,
  };
}

/** `C:\data\people.export.csv` → `people.export`, a suggested collection name. */
export function collectionFromPath(path: string): string {
  const name = path.split(/[\\/]/).pop() ?? "";
  const dot = name.lastIndexOf(".");
  return (dot > 0 ? name.slice(0, dot) : name).replace(/^[$.\s]+/, "").trim();
}

/** The columns as they will be imported: the file's columns with the user's changes. */
export function importColumns(
  preview: ImportPreview | undefined,
  values: ImportFormValues,
): ColumnValues[] {
  return (preview?.columns ?? []).map((column, index) => {
    const named = column.first.trim();
    return {
      include: true,
      field: values.header && named !== "" ? named : `field${index + 1}`,
      type: column.suggestion.type,
      dateFormat: column.suggestion.dateFormat || DEFAULT_DATE_FORMAT,
      ...values.columnEdits[index],
    };
  });
}

export interface ImportFormErrors {
  path?: string;
  collection?: string;
  columns?: string;
}

/** Checks what the backend cannot explain field by field; empty when the form is complete. */
export function validateImportForm(
  values: ImportFormValues,
  preview: ImportPreview | undefined,
): ImportFormErrors {
  const errors: ImportFormErrors = {};
  if (values.path.trim() === "") errors.path = "Choose a file.";
  if (values.collection.trim() === "") errors.collection = "Enter a collection name.";
  if (preview?.format === "csv") {
    const included = importColumns(preview, values).filter((column) => column.include);
    const names = included.map((column) => column.field.trim());
    if (included.length === 0) errors.columns = "Choose at least one column.";
    else if (names.includes("")) errors.columns = "Every imported column needs a field name.";
    else if (new Set(names).size !== names.length) {
      errors.columns = "Two columns have the same field name.";
    } else if (included.some((column) => column.type === "date" && !column.dateFormat.trim())) {
      errors.columns = "Enter the format of every date column.";
    }
  }
  return errors;
}

/** The request sent to `start_import`; CSV settings are left empty for JSON files. */
export function buildImportRequest(
  target: ImportTarget,
  values: ImportFormValues,
  preview: ImportPreview,
): ImportRequest {
  const csv = preview.format === "csv";
  return {
    database: target.database,
    collection: values.collection.trim(),
    path: values.path.trim(),
    format: preview.format,
    delimiter: preview.delimiter,
    header: csv && values.header,
    columns: csv
      ? importColumns(preview, values).map((column) => ({
          ...column,
          field: column.field.trim(),
          dateFormat: column.type === "date" ? column.dateFormat.trim() : "",
        }))
      : [],
    ignoreBlanks: csv && values.ignoreBlanks,
    parseErrors: csv ? values.parseErrors : "stop",
    mode: values.mode,
    matchFields:
      values.mode === "insert"
        ? []
        : values.matchFields
            .split(",")
            .map((field) => field.trim())
            .filter((field) => field !== ""),
    drop: values.drop,
    stopOnError: values.stopOnError,
  };
}
