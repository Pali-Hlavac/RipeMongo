/**
 * Monaco setup, loaded lazily with the editor: only the editor core (no bundled languages,
 * no TypeScript worker), one generic worker, and a small "mongosh" language for shell
 * syntax (`{ _id: ObjectId("…"), at: ISODate("…") }`). Nothing is fetched from a CDN.
 */
import * as monaco from "monaco-editor/editor/editor.api";
import EditorWorker from "monaco-editor/editor/editor.worker?worker";

export { monaco };

export const MONGOSH_LANGUAGE = "mongosh";
export const LIGHT_THEME = "ripemongo-light";
export const DARK_THEME = "ripemongo-dark";

/** Shell constructors highlighted as types. */
const CONSTRUCTORS = [
  "ObjectId",
  "ISODate",
  "Date",
  "NumberLong",
  "NumberInt",
  "NumberDecimal",
  "Decimal128",
  "UUID",
  "BinData",
  "Timestamp",
  "RegExp",
  "MinKey",
  "MaxKey",
  "new",
];

/**
 * Token colors as hex (Monaco themes cannot read CSS variables). They mirror the
 * `--syntax-*` tokens in `src/app/styles.css`.
 */
const LIGHT_COLORS = {
  key: "3b4fb0",
  string: "2f7d3b",
  number: "b0581a",
  keyword: "a3307c",
  type: "1f6f99",
  comment: "8a8a96",
};
const DARK_COLORS = {
  key: "a9b4f5",
  string: "8fd19e",
  number: "f0b37a",
  keyword: "e79ad0",
  type: "8ec9ea",
  comment: "7f7f8c",
};

function rules(colors: typeof LIGHT_COLORS): monaco.editor.ITokenThemeRule[] {
  return [
    { token: "key", foreground: colors.key },
    { token: "string", foreground: colors.string },
    { token: "number", foreground: colors.number },
    { token: "keyword", foreground: colors.keyword },
    { token: "type", foreground: colors.type },
    { token: "regexp", foreground: colors.string },
    { token: "comment", foreground: colors.comment, fontStyle: "italic" },
  ];
}

let initialized = false;

/** Registers the worker, language and themes once. */
export function setupMonaco(): typeof monaco {
  if (initialized) return monaco;
  initialized = true;
  self.MonacoEnvironment = { getWorker: () => new EditorWorker() };

  monaco.languages.register({ id: MONGOSH_LANGUAGE });
  monaco.languages.setLanguageConfiguration(MONGOSH_LANGUAGE, {
    comments: { lineComment: "//", blockComment: ["/*", "*/"] },
    brackets: [
      ["{", "}"],
      ["[", "]"],
      ["(", ")"],
    ],
    autoClosingPairs: [
      { open: "{", close: "}" },
      { open: "[", close: "]" },
      { open: "(", close: ")" },
      { open: '"', close: '"', notIn: ["string"] },
      { open: "'", close: "'", notIn: ["string"] },
    ],
  });
  monaco.languages.setMonarchTokensProvider(MONGOSH_LANGUAGE, {
    constructors: CONSTRUCTORS,
    tokenizer: {
      root: [
        [/\/\/.*$/, "comment"],
        [/\/\*/, "comment", "@comment"],
        [/"(?:[^"\\]|\\.)*"(?=\s*:)/, "key"],
        [/'(?:[^'\\]|\\.)*'(?=\s*:)/, "key"],
        [/[$\w.]+(?=\s*:)/, "key"],
        [/"(?:[^"\\]|\\.)*"/, "string"],
        [/'(?:[^'\\]|\\.)*'/, "string"],
        [/\/(?:[^/\\\n]|\\.)+\/[gimsux]*/, "regexp"],
        [/-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?/, "number"],
        [/\b(?:true|false|null|undefined|NaN|Infinity)\b/, "keyword"],
        [/[A-Za-z_$][\w$]*/, { cases: { "@constructors": "type", "@default": "identifier" } }],
      ],
      comment: [
        [/\*\//, "comment", "@pop"],
        [/[^*]+/, "comment"],
        [/\*/, "comment"],
      ],
    },
  });
  monaco.editor.defineTheme(LIGHT_THEME, {
    base: "vs",
    inherit: true,
    rules: rules(LIGHT_COLORS),
    colors: {},
  });
  monaco.editor.defineTheme(DARK_THEME, {
    base: "vs-dark",
    inherit: true,
    rules: rules(DARK_COLORS),
    colors: {},
  });
  return monaco;
}
