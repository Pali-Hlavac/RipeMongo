/** Field paths seen in loaded documents, for query autocomplete. */
import type { BsonField } from "./bson";
import type { LoadedDocument } from "../types";

/** Nesting depth explored; deeper paths are rarely typed by hand. */
const MAX_DEPTH = 4;
/** Upper bound so very wide documents cannot slow typing down. */
export const MAX_FIELD_PATHS = 500;

/** Dotted paths (`address.city`) in first-seen order; array items are looked into too. */
export function fieldPaths(documents: readonly LoadedDocument[]): string[] {
  const paths = new Set<string>();
  const visit = (fields: BsonField[], prefix: string, depth: number) => {
    for (const [name, value] of fields) {
      if (paths.size >= MAX_FIELD_PATHS) return;
      const path = prefix ? `${prefix}.${name}` : name;
      paths.add(path);
      if (depth >= MAX_DEPTH) continue;
      if (value.type === "document") visit(value.fields, path, depth + 1);
      if (value.type === "array") {
        for (const item of value.items) {
          if (item.type === "document") visit(item.fields, path, depth + 1);
        }
      }
    }
  };
  for (const document of documents) visit(document.value.fields, "", 1);
  return [...paths];
}
