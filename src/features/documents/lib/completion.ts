/**
 * Autocomplete for query inputs: finds the word being typed and whether it is a field name,
 * an operator or a value, then suggests field paths, `$` operators or shell constructors.
 */

export type QueryPart = "filter" | "projection" | "sort" | "collation";

export interface Suggestion {
  label: string;
  /** Text that replaces the word being typed. */
  insert: string;
  /** Caret position inside `insert` after accepting; defaults to its end. */
  caret?: number;
  kind: "field" | "operator" | "value";
}

export interface CompletionContext {
  /** Start of the word being typed (it ends at the caret). */
  start: number;
  word: string;
  /** What belongs at the caret: a field name (`key`) or a value. */
  slot: "key" | "value";
}

const FILTER_OPERATORS = [
  "$eq",
  "$ne",
  "$gt",
  "$gte",
  "$lt",
  "$lte",
  "$in",
  "$nin",
  "$exists",
  "$type",
  "$regex",
  "$options",
  "$and",
  "$or",
  "$nor",
  "$not",
  "$expr",
  "$elemMatch",
  "$size",
  "$all",
  "$mod",
  "$text",
  "$search",
  "$jsonSchema",
  "$where",
  "$geoWithin",
  "$geoIntersects",
  "$near",
  "$nearSphere",
  "$bitsAllSet",
  "$bitsAnySet",
  "$bitsAllClear",
  "$bitsAnyClear",
];
const PROJECTION_OPERATORS = ["$slice", "$elemMatch", "$meta"];
const COLLATION_KEYS = [
  "locale",
  "strength",
  "caseLevel",
  "caseFirst",
  "numericOrdering",
  "alternate",
  "maxVariable",
  "backwards",
];

/** Shell constructors; `caret` puts the cursor between the quotes. */
const VALUES: Suggestion[] = [
  ...["ObjectId", "ISODate", "NumberLong", "NumberInt", "NumberDecimal", "UUID", "RegExp"].map(
    (name): Suggestion => ({
      label: `${name}("")`,
      insert: `${name}("")`,
      caret: name.length + 2,
      kind: "value",
    }),
  ),
  { label: "Timestamp(0, 0)", insert: "Timestamp(0, 0)", kind: "value" },
  ...["true", "false", "null", "MinKey", "MaxKey"].map((word): Suggestion => ({
    label: word,
    insert: word,
    kind: "value",
  })),
];

const WORD_CHAR = /[\w$.]/;
/** Suggestions shown at once. */
export const MAX_SUGGESTIONS = 8;

/** Where the caret is: inside a string (no suggestions) or after a word in a key/value slot. */
export function completionContext(text: string, caret: number): CompletionContext | null {
  const stack: string[] = [];
  let quote: string | null = null;
  let start = caret;
  while (start > 0 && WORD_CHAR.test(text[start - 1] ?? "")) start -= 1;

  for (let i = 0; i < start; i += 1) {
    const char = text[i];
    if (quote) {
      if (char === "\\") i += 1;
      else if (char === quote) quote = null;
    } else if (char === '"' || char === "'") quote = char;
    else if (char === "{" || char === "[") stack.push(char);
    else if (char === "}" || char === "]") stack.pop();
  }
  if (quote) return null;

  let before = start - 1;
  while (before >= 0 && /\s/.test(text[before] ?? "")) before -= 1;
  const previous = before >= 0 ? text[before] : "";
  const inObject = stack.at(-1) === "{";
  const slot = inObject && (previous === "{" || previous === ",") ? "key" : "value";
  return { start, word: text.slice(start, caret), slot };
}

function matches(candidate: string, word: string): boolean {
  return candidate.toLowerCase().startsWith(word.toLowerCase()) && candidate !== word;
}

/** Suggestions for the word at the caret. `fields` are known field paths of the collection. */
export function suggest(
  context: CompletionContext,
  part: QueryPart,
  fields: readonly string[],
): Suggestion[] {
  const { word, slot } = context;
  let candidates: Suggestion[];
  if (part === "collation") {
    candidates =
      slot === "key"
        ? COLLATION_KEYS.map((key) => ({ label: key, insert: key, kind: "field" }))
        : [];
  } else if (word.startsWith("$")) {
    const operators =
      part === "projection" ? PROJECTION_OPERATORS : part === "filter" ? FILTER_OPERATORS : [];
    candidates = operators.map((op) => ({ label: op, insert: op, kind: "operator" }));
  } else if (slot === "key") {
    candidates = fields.map((field) => ({
      label: field,
      // Dotted paths must be quoted to be valid keys.
      insert: field.includes(".") ? JSON.stringify(field) : field,
      kind: "field",
    }));
  } else {
    candidates = part === "filter" ? VALUES : [];
  }
  return candidates.filter((c) => matches(c.label, word)).slice(0, MAX_SUGGESTIONS);
}

/** Text and caret after accepting `suggestion` for the word in `context`. */
export function applySuggestion(
  text: string,
  caret: number,
  context: CompletionContext,
  suggestion: Suggestion,
): { text: string; caret: number } {
  const next = text.slice(0, context.start) + suggestion.insert + text.slice(caret);
  return { text: next, caret: context.start + (suggestion.caret ?? suggestion.insert.length) };
}
