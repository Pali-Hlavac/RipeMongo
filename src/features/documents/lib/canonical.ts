/**
 * Typed BSON value → canonical Extended JSON, the exact format the backend sends. Used to
 * identify documents (`_id`) and to guard edits with the value as it was loaded.
 */
import type { BsonValue } from "./bson";

const NUMBER_KEYS = {
  int32: "$numberInt",
  int64: "$numberLong",
  double: "$numberDouble",
  decimal128: "$numberDecimal",
} as const;

const quote = (text: string) => JSON.stringify(text);

export function toCanonicalJson(value: BsonValue): string {
  switch (value.type) {
    case "document":
      return `{${value.fields.map(([name, field]) => `${quote(name)}:${toCanonicalJson(field)}`).join(",")}}`;
    case "array":
      return `[${value.items.map(toCanonicalJson).join(",")}]`;
    case "string":
      return quote(value.value);
    case "int32":
    case "int64":
    case "double":
    case "decimal128":
      return `{"${NUMBER_KEYS[value.type]}":${quote(value.value)}}`;
    case "boolean":
      return String(value.value);
    case "null":
      return "null";
    case "undefined":
      return '{"$undefined":true}';
    case "minKey":
      return '{"$minKey":1}';
    case "maxKey":
      return '{"$maxKey":1}';
    case "objectId":
      return `{"$oid":${quote(value.value)}}`;
    case "date":
      return `{"$date":{"$numberLong":${quote(value.ms)}}}`;
    case "binary":
      return `{"$binary":{"base64":${quote(value.base64)},"subType":${quote(value.subType)}}}`;
    case "regex":
      return `{"$regularExpression":{"pattern":${quote(value.pattern)},"options":${quote(value.options)}}}`;
    case "timestamp":
      return `{"$timestamp":{"t":${value.t},"i":${value.i}}}`;
    case "code":
      return `{"$code":${quote(value.code)}}`;
    case "symbol":
      return `{"$symbol":${quote(value.value)}}`;
    case "unknown":
      return value.json;
  }
}
