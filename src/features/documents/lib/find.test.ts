import type { LoadedDocument } from "../types";
import { parseDocument } from "./bson";
import {
  findId,
  findPrefix,
  hitFields,
  isWithin,
  jsonHits,
  listHits,
  occurrences,
  openPaths,
  pathKey,
  tableHits,
} from "./find";

const loaded = (key: string, json: string): LoadedDocument => ({
  key,
  json,
  value: parseDocument(json),
});

const documents = [
  loaded(
    "a",
    JSON.stringify({
      name: "Bratislava office",
      address: { city: "Bratislava", zip: "81101" },
      tags: ["brat", "x"],
      qty: { $numberInt: "7" },
    }),
  ),
  loaded("b", JSON.stringify({ name: "Košice", note: "BRATWURST" })),
];

describe("occurrences", () => {
  it("finds every occurrence, ignoring case, without overlaps", () => {
    expect(occurrences("Aaa aA", "aa")).toEqual([0, 4]);
    expect(occurrences("abc", "")).toEqual([]);
  });
});

describe("listHits", () => {
  it("searches names and leaf values depth first, but not array positions", () => {
    const hits = listHits(documents, "brat");
    expect(hits.map((hit) => hit.id)).toEqual([
      findId(findPrefix("a", "name", "value"), 0),
      findId(findPrefix("a", "address.city", "value"), 0),
      findId(findPrefix("a", "tags.0", "value"), 0),
      findId(findPrefix("b", "note", "value"), 0),
    ]);
    expect(hits.map((hit) => hit.document)).toEqual([0, 0, 0, 1]);
    // "1" is in the zip code (three times) and is the position of a tag, which is not searched.
    const ones = listHits(documents, "1").map((hit) => hit.id);
    expect(ones).toHaveLength(3);
    expect(ones).not.toContain(findId(findPrefix("a", "tags.1", "key"), 0));
    expect(listHits(documents, "zip")[0]?.id).toBe(
      findId(findPrefix("a", "address.zip", "key"), 0),
    );
    // Numbers are searched as shown: 7, not NumberInt(7).
    expect(listHits(documents, "7")).toHaveLength(1);
  });

  it("lists the objects to open and the top-level fields with hits", () => {
    const hits = listHits(documents, "brat");
    expect(openPaths(hits)).toEqual(new Set([pathKey("a", "address"), pathKey("a", "tags")]));
    expect(hitFields(hits)).toEqual(
      new Set([
        pathKey("a", "name"),
        pathKey("a", "address"),
        pathKey("a", "tags"),
        pathKey("b", "note"),
      ]),
    );
  });
});

describe("jsonHits and tableHits", () => {
  it("search what the JSON and table views show", () => {
    expect(jsonHits(documents, "brat")).toHaveLength(4);
    // Field names count in the JSON text.
    expect(jsonHits(documents, "zip")).toHaveLength(1);
    // The table shows nested objects as their size, so only top-level values match.
    const cells = tableHits(documents, "brat");
    expect(cells.map((hit) => hit.id)).toEqual([
      findId(findPrefix("a", "name", "cell"), 0),
      findId(findPrefix("b", "note", "cell"), 0),
    ]);
  });
});

describe("isWithin", () => {
  it("tells whether a hit lies in a piece of text", () => {
    const prefix = findPrefix("a", "name", "value");
    expect(isWithin(findId(prefix, 2), prefix)).toBe(true);
    expect(isWithin(findId(findPrefix("a", "name2", "value"), 0), prefix)).toBe(false);
    expect(isWithin(null, prefix)).toBe(false);
  });
});
