/** Pure helpers for the bulk update / delete dialogs. */
import { formatCount } from "@/shared/lib/format";

import type { DocumentCount } from "../types";
import { parseDocument } from "./bson";
import { toShell } from "./format";

/** Starting text of the update editor. */
export const UPDATE_TEMPLATE = "{\n  $set: {\n    \n  }\n}";

/** "1 document", "about 1,500 documents", "no documents". */
export function documentsPhrase({ count, estimated }: DocumentCount): string {
  if (count === null) return "an unknown number of documents";
  if (count === 0) return "no documents";
  const noun = count === 1 ? "document" : "documents";
  return `${estimated ? "about " : ""}${formatCount(count)} ${noun}`;
}

/** Whether the preview found something to change. */
export function hasMatches({ count }: DocumentCount): boolean {
  return count === null || count > 0;
}

/** A canonical Extended JSON sample in shell syntax. */
export function sampleText(json: string): string {
  return toShell(parseDocument(json));
}

/** Whether a backend message is about the named query part ("Update: Expected …"). */
export function isAbout(message: string, part: "Filter" | "Update"): boolean {
  return message.startsWith(`${part}: `);
}
