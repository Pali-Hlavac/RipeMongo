/**
 * Minimal JSON parser that keeps object entries in source order. `JSON.parse` moves
 * integer-like keys ("0", "42") to the front of objects, which would reorder document
 * fields; MongoDB field order is meaningful, so documents are parsed with this instead.
 */

export type JsonNode =
  | { kind: "object"; entries: [string, JsonNode][] }
  | { kind: "array"; items: JsonNode[] }
  | { kind: "string"; value: string }
  /** Kept as text so 64-bit integers never lose precision. */
  | { kind: "number"; raw: string }
  | { kind: "boolean"; value: boolean }
  | { kind: "null" };

const NUMBER = /-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?/y;
const WHITESPACE = /[ \t\n\r]*/y;

class Parser {
  private index = 0;

  constructor(private readonly text: string) {}

  parse(): JsonNode {
    const value = this.value();
    this.skipWhitespace();
    if (this.index !== this.text.length) this.fail("Unexpected text after the value");
    return value;
  }

  private value(): JsonNode {
    this.skipWhitespace();
    const char = this.text[this.index];
    switch (char) {
      case "{":
        return this.object();
      case "[":
        return this.array();
      case '"':
        return { kind: "string", value: this.string() };
      case "t":
        return this.literal("true", { kind: "boolean", value: true });
      case "f":
        return this.literal("false", { kind: "boolean", value: false });
      case "n":
        return this.literal("null", { kind: "null" });
      default:
        return this.number();
    }
  }

  private object(): JsonNode {
    const entries: [string, JsonNode][] = [];
    this.index += 1;
    this.skipWhitespace();
    if (this.text[this.index] === "}") {
      this.index += 1;
      return { kind: "object", entries };
    }
    for (;;) {
      this.skipWhitespace();
      if (this.text[this.index] !== '"') this.fail("Expected a field name");
      const key = this.string();
      this.skipWhitespace();
      this.expect(":");
      entries.push([key, this.value()]);
      this.skipWhitespace();
      if (this.text[this.index] === ",") {
        this.index += 1;
        continue;
      }
      this.expect("}");
      return { kind: "object", entries };
    }
  }

  private array(): JsonNode {
    const items: JsonNode[] = [];
    this.index += 1;
    this.skipWhitespace();
    if (this.text[this.index] === "]") {
      this.index += 1;
      return { kind: "array", items };
    }
    for (;;) {
      items.push(this.value());
      this.skipWhitespace();
      if (this.text[this.index] === ",") {
        this.index += 1;
        continue;
      }
      this.expect("]");
      return { kind: "array", items };
    }
  }

  /** Finds the closing quote, then lets `JSON.parse` decode the escapes. */
  private string(): string {
    const start = this.index;
    let end = start + 1;
    while (end < this.text.length && this.text[end] !== '"') {
      end += this.text[end] === "\\" ? 2 : 1;
    }
    if (end >= this.text.length) this.fail("Unterminated string");
    this.index = end + 1;
    return JSON.parse(this.text.slice(start, end + 1)) as string;
  }

  private number(): JsonNode {
    NUMBER.lastIndex = this.index;
    const match = NUMBER.exec(this.text);
    if (!match) this.fail("Unexpected character");
    this.index = NUMBER.lastIndex;
    return { kind: "number", raw: match[0] };
  }

  private literal(word: string, node: JsonNode): JsonNode {
    if (!this.text.startsWith(word, this.index)) this.fail("Unexpected character");
    this.index += word.length;
    return node;
  }

  private expect(char: string): void {
    if (this.text[this.index] !== char) this.fail(`Expected "${char}"`);
    this.index += 1;
  }

  private skipWhitespace(): void {
    WHITESPACE.lastIndex = this.index;
    WHITESPACE.exec(this.text);
    this.index = WHITESPACE.lastIndex;
  }

  private fail(message: string): never {
    throw new SyntaxError(`${message} at position ${this.index}`);
  }
}

/** Parses JSON text, preserving the order of object entries. Throws `SyntaxError`. */
export function parseOrderedJson(text: string): JsonNode {
  return new Parser(text).parse();
}
