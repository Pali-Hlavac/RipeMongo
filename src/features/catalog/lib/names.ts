/**
 * Client-side checks for database and collection names, so mistakes show while typing.
 * The server still has the final word (its limits depend on version and platform).
 */

/** Characters MongoDB rejects in database names on any platform. */
const INVALID_DATABASE_CHARS = /[/\\. "$*<>:|?\0]/;
/** Database names are limited to 64 bytes; checked in characters here for simplicity. */
const MAX_DATABASE_NAME_LENGTH = 63;

/** Returns why `name` is not a valid database name, or `null` when it is. */
export function databaseNameError(name: string): string | null {
  if (name.length === 0) return "Enter a database name.";
  if (INVALID_DATABASE_CHARS.test(name)) {
    return 'Database names cannot contain spaces or any of / \\ . " $ * < > : | ?';
  }
  if (name.length > MAX_DATABASE_NAME_LENGTH) {
    return `Database names can be at most ${MAX_DATABASE_NAME_LENGTH} characters long.`;
  }
  return null;
}

/** Returns why `name` is not a valid collection or view name, or `null` when it is. */
export function collectionNameError(name: string): string | null {
  if (name.length === 0) return "Enter a name.";
  if (name.includes("$")) return "Names cannot contain $.";
  if (name.includes("\0")) return "Names cannot contain the null character.";
  if (name.startsWith("system.")) return 'Names starting with "system." are reserved.';
  return null;
}
