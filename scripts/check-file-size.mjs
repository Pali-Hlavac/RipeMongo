// Enforces the source file size limits from docs/development/coding-standards.md:
// warns above the soft limit and fails above the hard limit (TS, TSX and Rust).
import { readdirSync, readFileSync, statSync } from "node:fs";
import { extname, join, relative } from "node:path";

const SOFT_LIMIT = 200;
const HARD_LIMIT = 300;
const ROOTS = ["src", "src-tauri/src", "src-tauri/tests", "scripts"];
const EXTENSIONS = new Set([".ts", ".tsx", ".rs", ".mjs"]);
const IGNORED = new Set(["src/shared/ipc/bindings.ts"]);
const SKIPPED_DIRS = new Set(["node_modules", "target", "gen"]);

/**
 * Recursively lists source files below `dir`.
 * @param {string} dir
 * @returns {string[]}
 */
function listSourceFiles(dir) {
  let entries;
  try {
    entries = readdirSync(dir);
  } catch {
    return [];
  }
  return entries.flatMap((entry) => {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) return SKIPPED_DIRS.has(entry) ? [] : listSourceFiles(path);
    return EXTENSIONS.has(extname(entry)) ? [path] : [];
  });
}

/**
 * Counts non-blank lines.
 * @param {string} path
 */
function countLines(path) {
  return readFileSync(path, "utf8")
    .split("\n")
    .filter((line) => line.trim() !== "").length;
}

let failed = false;
for (const file of ROOTS.flatMap(listSourceFiles)) {
  const name = relative(".", file).replaceAll("\\", "/");
  if (IGNORED.has(name)) continue;
  const lines = countLines(file);
  if (lines > HARD_LIMIT) {
    console.error(`✖ ${name}: ${lines} lines (hard limit ${HARD_LIMIT}) — split this file.`);
    failed = true;
  } else if (lines > SOFT_LIMIT) {
    console.warn(`⚠ ${name}: ${lines} lines (soft limit ${SOFT_LIMIT}) — consider splitting.`);
  }
}
process.exit(failed ? 1 : 0);
