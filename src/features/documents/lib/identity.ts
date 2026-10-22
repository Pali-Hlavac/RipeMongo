/** Identifying loaded documents for writes. */
import type { LoadedDocument } from "../types";
import { getField, type BsonDocument } from "./bson";
import { toCanonicalJson } from "./canonical";

/** `_id` of a loaded document as canonical JSON, or `null` if it was projected away. */
export function documentId(document: LoadedDocument): string | null {
  const id = getField(document.value, "_id");
  return id ? toCanonicalJson(id) : null;
}

/** The document without its `_id` (for cloning). */
export function withoutId(value: BsonDocument): BsonDocument {
  return { ...value, fields: value.fields.filter(([name]) => name !== "_id") };
}
