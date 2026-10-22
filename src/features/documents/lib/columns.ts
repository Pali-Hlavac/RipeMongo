/** Column set of the table view: the top-level fields of the loaded page. */
import type { LoadedDocument } from "../types";

/** Upper bound on columns so documents with thousands of keys don't freeze the table. */
export const MAX_COLUMNS = 200;

/** Field names in order of first appearance, `_id` first. */
export function columnNames(documents: LoadedDocument[]): string[] {
  const names = new Set<string>(["_id"]);
  let sawId = false;
  for (const document of documents) {
    for (const [name] of document.value.fields) {
      if (name === "_id") sawId = true;
      names.add(name);
      if (names.size >= MAX_COLUMNS) break;
    }
  }
  if (!sawId) names.delete("_id");
  return [...names];
}
