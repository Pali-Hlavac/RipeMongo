import { parseDocument } from "./bson";
import { applySuggestion, completionContext, suggest } from "./completion";
import { fieldPaths } from "./fields";

const at = (textWithCaret: string) => {
  const caret = textWithCaret.indexOf("|");
  const text = textWithCaret.replace("|", "");
  return { text, caret, context: completionContext(text, caret) };
};

const FIELDS = ["name", "address", "address.city", "age"];

describe("completionContext", () => {
  it("tells keys from values", () => {
    expect(at("{ na|").context).toEqual({ start: 2, word: "na", slot: "key" });
    expect(at("{ a: 1, ag|").context?.slot).toBe("key");
    expect(at("{ a: Obj|").context?.slot).toBe("value");
    expect(at("{ a: { $in: [1, Obj|").context?.slot).toBe("value");
  });

  it("offers nothing inside strings", () => {
    expect(at('{ a: "na|').context).toBeNull();
    expect(at('{ a: "x\\"y", b|').context?.slot).toBe("key");
  });
});

describe("suggest", () => {
  it("suggests fields for keys and quotes dotted paths", () => {
    const { context } = at("{ add|");
    const labels = suggest(context ?? { start: 0, word: "", slot: "key" }, "filter", FIELDS);
    expect(labels.map((s) => s.insert)).toEqual(["address", '"address.city"']);
  });

  it("suggests operators by part and constructors for filter values", () => {
    const op = at("{ age: { $l|").context;
    expect(op && suggest(op, "filter", FIELDS).map((s) => s.label)).toEqual(["$lt", "$lte"]);
    expect(op && suggest(op, "sort", FIELDS)).toEqual([]);
    const value = at("{ _id: Obj|").context;
    expect(value && suggest(value, "filter", FIELDS).map((s) => s.label)).toEqual(['ObjectId("")']);
  });

  it("places the caret inside a constructor's quotes", () => {
    const { text, caret, context } = at("{ _id: Obj| }");
    if (!context) throw new Error("expected a context");
    const [objectId] = suggest(context, "filter", FIELDS);
    if (!objectId) throw new Error("expected a suggestion");
    expect(applySuggestion(text, caret, context, objectId)).toEqual({
      text: '{ _id: ObjectId("") }',
      caret: 17,
    });
  });
});

describe("fieldPaths", () => {
  it("collects nested paths including documents inside arrays", () => {
    const doc = parseDocument(
      JSON.stringify({ a: 1, b: { c: 2 }, items: [{ sku: "x" }, { qty: 1 }] }),
    );
    expect(fieldPaths([{ key: "1", json: "", value: doc }])).toEqual([
      "a",
      "b",
      "b.c",
      "items",
      "items.sku",
      "items.qty",
    ]);
  });
});
