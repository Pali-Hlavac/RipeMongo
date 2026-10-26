import type { ExportFormat, ExportRequest, FieldSample } from "@/shared/ipc/bindings";

import type { ExportTarget } from "../store/transfer";

/** Largest skip or limit the backend accepts (u32). */
export const MAX_COUNT = 4_294_967_295;

/** Everything the export dialog edits. Numbers stay text until the request is built. */
export interface ExportFormValues {
  format: ExportFormat;
  path: string;
  /** Sampled fields the user unticked (all are ticked at first). */
  unticked: string[];
  /** Comma-separated fields that are not in the sample. */
  extraFields: string;
  jsonArray: boolean;
  pretty: boolean;
  canonical: boolean;
  header: boolean;
  filter: string;
  sort: string;
  skip: string;
  limit: string;
}

const EXTENSIONS: Record<ExportFormat, string> = { json: ".json", csv: ".csv" };

/** `orders.json`, or the path with its extension switched to the format. */
export function exportFileName(path: string, format: ExportFormat): string {
  const known = Object.values(EXTENSIONS).find((extension) =>
    path.toLowerCase().endsWith(extension),
  );
  return known ? path.slice(0, -known.length) + EXTENSIONS[format] : path;
}

/** Starting values, with the query of the documents tab it was opened from. */
export function initialExportValues(target: ExportTarget): ExportFormValues {
  const query = target.query;
  return {
    format: "json",
    path: "",
    unticked: [],
    extraFields: "",
    jsonArray: false,
    pretty: false,
    canonical: false,
    header: true,
    filter: query?.filter ?? "",
    sort: query?.sort ?? "",
    skip: query?.skip ? String(query.skip) : "",
    limit: query?.limit ? String(query.limit) : "",
  };
}

/** JSON exports pick whole top-level fields; CSV columns can be nested paths. */
export function sampledFields(sample: FieldSample | undefined, format: ExportFormat): string[] {
  if (!sample) return [];
  return format === "json" ? sample.fields : sample.paths;
}

/** "a, ,b.c" → ["a", "b.c"]. */
export function parseFieldList(text: string): string[] {
  return text
    .split(",")
    .map((field) => field.trim())
    .filter((field) => field !== "");
}

/**
 * Fields sent to mongoexport. An empty list exports whole documents, which JSON exports do
 * when every sampled field is ticked (so fields missing from the sample are kept too).
 */
export function chosenFields(values: ExportFormValues, sampled: string[]): string[] {
  const extra = parseFieldList(values.extraFields);
  const ticked = sampled.filter((field) => !values.unticked.includes(field));
  if (values.format === "json" && ticked.length === sampled.length && extra.length === 0) {
    return [];
  }
  return [...new Set([...ticked, ...extra])];
}

/** A whole number from 0 to `MAX_COUNT`, `null` when blank, `undefined` when invalid. */
export function parseCount(text: string): number | null | undefined {
  const trimmed = text.trim();
  if (trimmed === "") return null;
  const value = Number(trimmed);
  return Number.isInteger(value) && value >= 0 && value <= MAX_COUNT ? value : undefined;
}

export interface ExportFormErrors {
  path?: string;
  fields?: string;
  skip?: string;
  limit?: string;
}

/** Checks what the backend cannot explain field by field; empty when the form is complete. */
export function validateExportForm(values: ExportFormValues, sampled: string[]): ExportFormErrors {
  const errors: ExportFormErrors = {};
  if (values.path.trim() === "") errors.path = "Choose a file.";
  const ticked = sampled.filter((field) => !values.unticked.includes(field));
  const none = ticked.length === 0 && parseFieldList(values.extraFields).length === 0;
  // A JSON export of a collection without sampled fields (empty) exports whole documents.
  if (none && (values.format === "csv" || sampled.length > 0)) {
    errors.fields =
      values.format === "csv" ? "Choose the fields that become columns." : "Choose a field.";
  }
  if (parseCount(values.skip) === undefined) errors.skip = "Enter a whole number.";
  if (parseCount(values.limit) === undefined) errors.limit = "Enter a whole number.";
  return errors;
}

/** The request sent to `start_export`; options of the other format are switched off. */
export function buildExportRequest(
  target: ExportTarget,
  values: ExportFormValues,
  sampled: string[],
): ExportRequest {
  const json = values.format === "json";
  const blank = (text: string) => (text.trim() === "" ? null : text.trim());
  return {
    database: target.database,
    collection: target.collection,
    path: values.path.trim(),
    format: values.format,
    fields: chosenFields(values, sampled),
    jsonArray: json && values.jsonArray,
    pretty: json && values.pretty,
    canonical: json && values.canonical,
    header: !json && values.header,
    query: blank(values.filter),
    sort: blank(values.sort),
    skip: parseCount(values.skip) ?? null,
    limit: parseCount(values.limit) ?? null,
  };
}
