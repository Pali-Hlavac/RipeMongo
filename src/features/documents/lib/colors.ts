/** Syntax colors of document values. */
import type { BsonValue } from "./bson";

/** Syntax color per value type (tokens from `styles.css`). */
export function valueColor(value: BsonValue): string {
  switch (value.type) {
    case "string":
      return "text-syntax-string";
    case "int32":
    case "int64":
    case "double":
    case "decimal128":
      return "text-syntax-number";
    case "boolean":
    case "null":
    case "undefined":
    case "minKey":
    case "maxKey":
      return "text-syntax-keyword";
    case "document":
    case "array":
      return "text-muted-foreground";
    default:
      return "text-syntax-type";
  }
}
