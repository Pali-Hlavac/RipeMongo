import { getField, parseDocument } from "./bson";
import { previewText, toShell, typeLabel } from "./format";
import { parseOrderedJson } from "./ordered-json";

const CANONICAL = JSON.stringify({
  _id: { $oid: "65a1b2c3d4e5f60718293a4b" },
  n: { $numberInt: "7" },
  big: { $numberLong: "9007199254740993" },
  price: { $numberDouble: "2.0" },
  dec: { $numberDecimal: "0.1" },
  at: { $date: { $numberLong: "1704067200000" } },
  id: { $binary: { base64: "ASNFZ4mrze8BI0VniavN7w==", subType: "04" } },
  re: { $regularExpression: { pattern: "^a/b", options: "i" } },
  ts: { $timestamp: { t: 1, i: 2 } },
  tags: ["x", { $numberInt: "1" }],
  nested: { "weird key": null, ok: true },
});

describe("parseOrderedJson", () => {
  it("keeps integer-like keys in source order", () => {
    const node = parseOrderedJson('{"b":1,"10":2,"a":{"2":3,"1":4}}');
    expect(node.kind === "object" && node.entries.map(([key]) => key)).toEqual(["b", "10", "a"]);
  });

  it("decodes escapes and rejects broken input", () => {
    expect(parseOrderedJson('"a\\"b\\u00e9"')).toEqual({ kind: "string", value: 'a"bé' });
    expect(() => parseOrderedJson('{"a":1,}')).toThrow(SyntaxError);
    expect(() => parseOrderedJson("[1] 2")).toThrow(SyntaxError);
  });
});

describe("parseDocument", () => {
  const doc = parseDocument(CANONICAL);

  it("maps canonical wrappers to typed values without losing precision", () => {
    expect(getField(doc, "big")).toEqual({ type: "int64", value: "9007199254740993" });
    expect(getField(doc, "_id")).toEqual({ type: "objectId", value: "65a1b2c3d4e5f60718293a4b" });
    expect(getField(doc, "at")).toEqual({ type: "date", ms: "1704067200000" });
    expect(typeLabel(getField(doc, "id") ?? { type: "null" })).toBe("UUID");
  });

  it("writes shell syntax the backend parser accepts", () => {
    expect(toShell(doc)).toBe(`{
  _id: ObjectId("65a1b2c3d4e5f60718293a4b"),
  n: 7,
  big: NumberLong("9007199254740993"),
  price: 2.0,
  dec: NumberDecimal("0.1"),
  at: ISODate("2024-01-01T00:00:00.000Z"),
  id: UUID("01234567-89ab-cdef-0123-456789abcdef"),
  re: RegExp("^a/b", "i"),
  ts: Timestamp(1, 2),
  tags: [
    "x",
    1
  ],
  nested: {
    "weird key": null,
    ok: true
  }
}`);
  });

  it("previews values for cells and collapsed nodes", () => {
    expect(previewText(getField(doc, "at") ?? { type: "null" })).toBe("2024-01-01T00:00:00.000Z");
    expect(previewText(getField(doc, "tags") ?? { type: "null" })).toBe("[ 2 items ]");
    expect(previewText(getField(doc, "nested") ?? { type: "null" })).toBe("{ 2 fields }");
  });

  it("keeps unknown $-wrappers as raw JSON", () => {
    const odd = parseDocument('{"x":{"$foo":1,"$bar":2}}');
    expect(getField(odd, "x")).toEqual({ type: "unknown", json: '{"$foo":1,"$bar":2}' });
  });
});
