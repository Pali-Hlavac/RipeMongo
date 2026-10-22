// Guards Monaco against Tauri's `freezePrototype`: with a frozen Object.prototype, assigning a
// property such as `toString` on a plain object throws, and the editor fails to load. Our pnpm
// patch (patches/monaco-editor@*.patch) rewrites the known cases; this check fails when a Monaco
// upgrade brings new ones, so they are patched before they crash the app.
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const MONACO_ESM = "node_modules/monaco-editor/esm";
/** Names that every object inherits from Object.prototype. */
const PROTOTYPE_NAMES = [
  "toString",
  "toLocaleString",
  "valueOf",
  "hasOwnProperty",
  "isPrototypeOf",
  "propertyIsEnumerable",
  "constructor",
];
const ASSIGNMENT = new RegExp(String.raw`\b[\w$]+\.(${PROTOTYPE_NAMES.join("|")})\s*=(?!=)`);
/** Not loaded by the app (only the editor core is bundled), or assigning on a function. */
const SKIPPED = ["vs/languages/", "vs/platform/instantiation/common/instantiation.js"];

/**
 * Recursively lists JavaScript files below `dir`.
 * @param {string} dir
 * @returns {string[]}
 */
function listScripts(dir) {
  return readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) return listScripts(path);
    return entry.endsWith(".js") ? [path] : [];
  });
}

/** @type {string[]} */
const offenders = [];
for (const file of listScripts(MONACO_ESM)) {
  const name = relative(MONACO_ESM, file).replaceAll("\\", "/");
  if (SKIPPED.some((prefix) => name.startsWith(prefix))) continue;
  readFileSync(file, "utf8")
    .split("\n")
    .forEach((line, index) => {
      // Assigning on a prototype is fine: it defines an own property there.
      if (ASSIGNMENT.test(line) && !line.includes(".prototype.")) {
        offenders.push(`${name}:${index + 1}: ${line.trim()}`);
      }
    });
}

if (offenders.length > 0) {
  console.error("✖ Monaco assigns Object.prototype names, which fails under freezePrototype:");
  for (const offender of offenders) console.error(`  ${offender}`);
  console.error(
    "  Extend patches/monaco-editor@*.patch (pnpm patch) to use Object.defineProperty.",
  );
  process.exit(1);
}
