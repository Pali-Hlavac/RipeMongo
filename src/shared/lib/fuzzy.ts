/**
 * Fuzzy name matching for filters and pickers. A query matches when it appears in the text
 * (ignoring case), or when its characters appear in order in chunks that each start a word:
 * `oi` finds `orderItems`, `usr_pro` finds `user_profiles`, but `ord` does not find
 * `oxrxd`. Matches carry the character ranges to highlight and a score for ranking.
 */

/** Highlighted characters `[start, end)` of the matched text. */
export type MatchRange = readonly [start: number, end: number];

export interface FuzzyMatch {
  /** Higher is better: prefix > word start > anywhere > word chunks. */
  score: number;
  ranges: MatchRange[];
}

const SCORE = { prefix: 4, wordStart: 3, substring: 2, chunks: 1 } as const;

/** Matches everything without highlighting (an empty query). */
const EVERYTHING: FuzzyMatch = { score: 0, ranges: [] };

/** True when `text[index]` starts a word: after a separator, a case change or a digit run. */
export function isWordStart(text: string, index: number): boolean {
  if (index === 0) return true;
  const previous = text.charAt(index - 1);
  const current = text.charAt(index);
  if (!/[\p{L}\p{N}]/u.test(previous)) return true;
  const upper = (char: string) => char !== char.toLowerCase() && char === char.toUpperCase();
  if (upper(current) && !upper(previous)) return true;
  return /\d/.test(current) && !/\d/.test(previous);
}

/** Matches `query` against `text`; null when it does not match. */
export function fuzzyMatch(query: string, text: string): FuzzyMatch | null {
  const needle = query.trim().toLowerCase();
  if (needle === "") return EVERYTHING;
  const haystack = text.toLowerCase();
  // Case folding can change lengths (rare); positions are then only approximate.
  const found = haystack.indexOf(needle);
  if (found !== -1) {
    const start = isWordStart(text, found) ? found : wordStartIndex(text, haystack, needle);
    const at = start ?? found;
    const score = at === 0 ? SCORE.prefix : start !== null ? SCORE.wordStart : SCORE.substring;
    return { score, ranges: [[at, at + needle.length]] };
  }
  const ranges = chunks(text, haystack, needle);
  return ranges ? { score: SCORE.chunks, ranges } : null;
}

/** Index of an occurrence of `needle` that starts a word, if any. */
function wordStartIndex(text: string, haystack: string, needle: string): number | null {
  for (let at = haystack.indexOf(needle); at !== -1; at = haystack.indexOf(needle, at + 1)) {
    if (isWordStart(text, at)) return at;
  }
  return null;
}

/**
 * Places the needle's characters in order, each either right after the previous one or at
 * the start of a word. Depth-first with memoized dead ends; names are short.
 */
function chunks(text: string, haystack: string, needle: string): MatchRange[] | null {
  const failed = new Set<string>();
  const positions: number[] = [];

  const place = (needleIndex: number, from: number, previous: number): boolean => {
    if (needleIndex === needle.length) return true;
    const key = `${needleIndex}:${from}:${previous}`;
    if (failed.has(key)) return false;
    const char = needle.charAt(needleIndex);
    for (let at = haystack.indexOf(char, from); at !== -1; at = haystack.indexOf(char, at + 1)) {
      if (at !== previous + 1 && !isWordStart(text, at)) continue;
      positions.push(at);
      if (place(needleIndex + 1, at + 1, at)) return true;
      positions.pop();
    }
    failed.add(key);
    return false;
  };

  return place(0, 0, -2) ? toRanges(positions) : null;
}

/** Merges adjacent positions into ranges. */
function toRanges(positions: readonly number[]): MatchRange[] {
  const ranges: [number, number][] = [];
  for (const position of positions) {
    const last = ranges.at(-1);
    if (last?.[1] === position) last[1] = position + 1;
    else ranges.push([position, position + 1]);
  }
  return ranges;
}
