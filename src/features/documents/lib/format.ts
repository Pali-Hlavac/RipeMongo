/**
 * Text forms of BSON values: mongosh-style shell syntax (round-trips through the backend
 * parser, used by the JSON view and for copying) and short previews for the tree and table.
 */
import type { BsonValue } from "./bson";

const TYPE_LABELS: Record<BsonValue["type"], string> = {
  document: "Object",
  array: "Array",
  string: "String",
  int32: "Int32",
  int64: "Int64",
  double: "Double",
  decimal128: "Decimal128",
  boolean: "Boolean",
  null: "Null",
  undefined: "Undefined",
  minKey: "MinKey",
  maxKey: "MaxKey",
  objectId: "ObjectId",
  date: "Date",
  binary: "Binary",
  regex: "RegExp",
  timestamp: "Timestamp",
  code: "Code",
  symbol: "Symbol",
  unknown: "Extended JSON",
};

const UUID_SUBTYPE = "04";
const IDENTIFIER = /^[A-Za-z_$][\w$]*$/;
const INDENT = "  ";
/** Longest preview before it is cut with "…". */
const PREVIEW_CHARS = 120;

export function typeLabel(value: BsonValue): string {
  if (value.type === "binary" && value.subType === UUID_SUBTYPE) return "UUID";
  return TYPE_LABELS[value.type];
}

/** `"0123…"` (base64) → `"01234567-89ab-…"`; `null` if the bytes are not a UUID. */
export function uuidText(base64: string): string | null {
  let hex = "";
  try {
    for (const char of atob(base64)) hex += char.charCodeAt(0).toString(16).padStart(2, "0");
  } catch {
    return null;
  }
  if (hex.length !== 32) return null;
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/** ISO text of a date, or `null` when outside the range JavaScript dates support. */
export function isoDate(ms: string): string | null {
  const date = new Date(Number(ms));
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function doubleText(value: string): string {
  if (value === "Infinity" || value === "NaN") return value;
  if (value === "-Infinity" || value === "-0.0" || value === "-0") {
    return `{ $numberDouble: "${value}" }`;
  }
  // Keep a decimal point so the value is read back as a double, not an integer.
  return /^-?\d+$/.test(value) ? `${value}.0` : value;
}

function fieldName(name: string): string {
  return IDENTIFIER.test(name) ? name : JSON.stringify(name);
}

/** Single-line shell text, e.g. `ObjectId("…")`; documents and arrays stay on one line. */
export function scalarShell(value: BsonValue): string {
  switch (value.type) {
    case "string":
      return JSON.stringify(value.value);
    case "int32":
      return value.value;
    case "int64":
      return `NumberLong("${value.value}")`;
    case "double":
      return doubleText(value.value);
    case "decimal128":
      return `NumberDecimal("${value.value}")`;
    case "boolean":
      return String(value.value);
    case "null":
    case "undefined":
      return value.type;
    case "minKey":
      return "MinKey";
    case "maxKey":
      return "MaxKey";
    case "objectId":
      return `ObjectId("${value.value}")`;
    case "date": {
      const iso = isoDate(value.ms);
      return iso ? `ISODate("${iso}")` : `{ $date: { $numberLong: "${value.ms}" } }`;
    }
    case "binary": {
      const uuid = value.subType === UUID_SUBTYPE ? uuidText(value.base64) : null;
      return uuid
        ? `UUID("${uuid}")`
        : `BinData(${parseInt(value.subType, 16)}, "${value.base64}")`;
    }
    case "regex":
      return /[/\n]/.test(value.pattern)
        ? `RegExp(${JSON.stringify(value.pattern)}, "${value.options}")`
        : `/${value.pattern}/${value.options}`;
    case "timestamp":
      return `Timestamp(${value.t}, ${value.i})`;
    case "code":
      return `{ $code: ${JSON.stringify(value.code)} }`;
    case "symbol":
      return `{ $symbol: ${JSON.stringify(value.value)} }`;
    case "unknown":
      return value.json;
    case "document":
      return value.fields.length === 0
        ? "{}"
        : `{ ${value.fields.map(([k, v]) => `${fieldName(k)}: ${scalarShell(v)}`).join(", ")} }`;
    case "array":
      return `[${value.items.map(scalarShell).join(", ")}]`;
  }
}

/** Pretty, multi-line shell syntax, e.g. `{\n  _id: ObjectId("…"),\n  n: 1\n}`. */
export function toShell(value: BsonValue, depth = 0): string {
  const pad = INDENT.repeat(depth + 1);
  const close = INDENT.repeat(depth);
  if (value.type === "document" && value.fields.length > 0) {
    const lines = value.fields.map(([k, v]) => `${pad}${fieldName(k)}: ${toShell(v, depth + 1)}`);
    return `{\n${lines.join(",\n")}\n${close}}`;
  }
  if (value.type === "array" && value.items.length > 0) {
    const lines = value.items.map((item) => `${pad}${toShell(item, depth + 1)}`);
    return `[\n${lines.join(",\n")}\n${close}]`;
  }
  return scalarShell(value);
}

function truncate(text: string): string {
  return text.length > PREVIEW_CHARS ? `${text.slice(0, PREVIEW_CHARS)}…` : text;
}

/**
 * Short one-line text for a cell or a collapsed tree node: strings without quotes, dates
 * as ISO text, containers as their size.
 */
export function previewText(value: BsonValue): string {
  switch (value.type) {
    case "string":
      return truncate(value.value);
    case "objectId":
      return value.value;
    case "int32":
    case "int64":
    case "double":
    case "decimal128":
      return value.value;
    case "date":
      return isoDate(value.ms) ?? `${value.ms} ms`;
    case "binary":
      return (
        (value.subType === UUID_SUBTYPE ? uuidText(value.base64) : null) ??
        truncate(scalarShell(value))
      );
    case "document":
      return value.fields.length === 1 ? "{ 1 field }" : `{ ${value.fields.length} fields }`;
    case "array":
      return value.items.length === 1 ? "[ 1 item ]" : `[ ${value.items.length} items ]`;
    default:
      return truncate(scalarShell(value));
  }
}
