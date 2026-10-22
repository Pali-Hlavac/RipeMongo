/**
 * Typed, ordered model of BSON values, built from the canonical Extended JSON the backend
 * sends (`{"$oid": …}`, `{"$numberLong": …}`, …). Numbers stay strings so Int64 and
 * Decimal128 are never rounded.
 */
import { parseOrderedJson, type JsonNode } from "./ordered-json";

export type BsonField = [name: string, value: BsonValue];

export type BsonValue =
  | { type: "document"; fields: BsonField[] }
  | { type: "array"; items: BsonValue[] }
  | { type: "string"; value: string }
  | { type: "int32" | "int64" | "double" | "decimal128"; value: string }
  | { type: "boolean"; value: boolean }
  | { type: "null" | "undefined" | "minKey" | "maxKey" }
  | { type: "objectId"; value: string }
  /** Milliseconds since the epoch, as text (dates can exceed JS `Date` range). */
  | { type: "date"; ms: string }
  | { type: "binary"; base64: string; subType: string }
  | { type: "regex"; pattern: string; options: string }
  | { type: "timestamp"; t: number; i: number }
  | { type: "code"; code: string }
  | { type: "symbol"; value: string }
  /** Any other `$`-wrapper, kept as its raw JSON so nothing is lost. */
  | { type: "unknown"; json: string };

export type BsonDocument = Extract<BsonValue, { type: "document" }>;

const NUMBER_TYPES = {
  $numberInt: "int32",
  $numberLong: "int64",
  $numberDouble: "double",
  $numberDecimal: "decimal128",
} as const;

function text(node: JsonNode | undefined): string {
  if (node?.kind === "string") return node.value;
  if (node?.kind === "number") return node.raw;
  return "";
}

function entry(node: JsonNode | undefined, key: string): JsonNode | undefined {
  return node?.kind === "object" ? node.entries.find(([name]) => name === key)?.[1] : undefined;
}

function toJson(node: JsonNode): string {
  switch (node.kind) {
    case "object":
      return `{${node.entries.map(([k, v]) => `${JSON.stringify(k)}:${toJson(v)}`).join(",")}}`;
    case "array":
      return `[${node.items.map(toJson).join(",")}]`;
    case "string":
      return JSON.stringify(node.value);
    case "number":
      return node.raw;
    case "boolean":
      return String(node.value);
    case "null":
      return "null";
  }
}

/** Interprets a `{"$…": …}` wrapper; `null` when the object is a plain document. */
function wrapper(entries: [string, JsonNode][]): BsonValue | null {
  const [first] = entries;
  if (!first?.[0].startsWith("$")) return null;
  const [key, value] = first;
  if (entries.length === 1) {
    if (key in NUMBER_TYPES) {
      return { type: NUMBER_TYPES[key as keyof typeof NUMBER_TYPES], value: text(value) };
    }
    switch (key) {
      case "$oid":
        return { type: "objectId", value: text(value) };
      case "$date":
        return { type: "date", ms: text(entry(value, "$numberLong")) || text(value) };
      case "$binary":
        return {
          type: "binary",
          base64: text(entry(value, "base64")),
          subType: text(entry(value, "subType")),
        };
      case "$regularExpression":
        return {
          type: "regex",
          pattern: text(entry(value, "pattern")),
          options: text(entry(value, "options")),
        };
      case "$timestamp":
        return {
          type: "timestamp",
          t: Number(text(entry(value, "t"))),
          i: Number(text(entry(value, "i"))),
        };
      case "$minKey":
        return { type: "minKey" };
      case "$maxKey":
        return { type: "maxKey" };
      case "$undefined":
        return { type: "undefined" };
      case "$code":
        return { type: "code", code: text(value) };
      case "$symbol":
        return { type: "symbol", value: text(value) };
    }
  }
  return entries.every(([name]) => name.startsWith("$"))
    ? { type: "unknown", json: toJson({ kind: "object", entries }) }
    : null;
}

/** Converts one canonical Extended JSON node into a BSON value. */
export function fromCanonical(node: JsonNode): BsonValue {
  switch (node.kind) {
    case "object":
      return (
        wrapper(node.entries) ?? {
          type: "document",
          fields: node.entries.map(([name, value]) => [name, fromCanonical(value)]),
        }
      );
    case "array":
      return { type: "array", items: node.items.map(fromCanonical) };
    case "string":
      return { type: "string", value: node.value };
    case "number":
      // Canonical EJSON wraps every number; a bare one is treated as a double.
      return { type: "double", value: node.raw };
    case "boolean":
      return { type: "boolean", value: node.value };
    case "null":
      return { type: "null" };
  }
}

/** Parses a document sent by the backend (canonical Extended JSON). */
export function parseDocument(json: string): BsonDocument {
  const value = fromCanonical(parseOrderedJson(json));
  if (value.type !== "document") throw new SyntaxError("Expected a document");
  return value;
}

/** Top-level field of a document, if present. */
export function getField(document: BsonDocument, name: string): BsonValue | undefined {
  return document.fields.find(([field]) => field === name)?.[1];
}
