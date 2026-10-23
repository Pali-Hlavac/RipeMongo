import {
  buildDumpRequest,
  defaultArchiveName,
  dumpScope,
  initialDumpValues,
  parseParallel,
} from "./dump";

const server = { connectionId: "c1", database: null, collection: null };
const database = { connectionId: "c1", database: "shop", collection: null };
const collection = { connectionId: "c1", database: "shop", collection: "orders" };

describe("dump helpers", () => {
  it("describes the scope", () => {
    expect(dumpScope(server)).toBe("all databases");
    expect(dumpScope(database)).toBe("shop");
    expect(dumpScope(collection)).toBe("shop.orders");
  });

  it("suggests dated archive names", () => {
    const day = new Date(2026, 9, 2);
    expect(defaultArchiveName(collection, true, day)).toBe("shop.orders-2026-10-02.archive.gz");
    expect(defaultArchiveName(server, false, day)).toBe("all-databases-2026-10-02.archive");
  });

  it("accepts parallelism from 1 to 16, or blank for the default", () => {
    expect(parseParallel(" ")).toBeNull();
    expect(parseParallel("8")).toBe(8);
    expect(parseParallel("0")).toBeUndefined();
    expect(parseParallel("17")).toBeUndefined();
    expect(parseParallel("2.5")).toBeUndefined();
  });

  it("builds the request with only the options of the scope", () => {
    const values = {
      ...initialDumpValues(database),
      path: "  C:\\dumps ",
      query: "{ a: 1 }",
      oplog: true,
      excluded: ["logs"],
      prefixes: " tmp_, ,cache_",
      parallel: "2",
    };
    expect(buildDumpRequest(database, values)).toEqual({
      database: "shop",
      collection: null,
      output: { kind: "folder", path: "C:\\dumps" },
      gzip: false,
      query: null,
      oplog: false,
      excludeCollections: ["logs"],
      excludePrefixes: ["tmp_", "cache_"],
      parallelCollections: 2,
    });
    expect(buildDumpRequest(collection, values)).toMatchObject({
      query: "{ a: 1 }",
      excludeCollections: [],
      parallelCollections: null,
    });
    expect(buildDumpRequest(server, values)).toMatchObject({ oplog: true, excludePrefixes: [] });
  });

  it("starts from a saved dump's settings", () => {
    const request = buildDumpRequest(database, {
      ...initialDumpValues(database),
      kind: "archive",
      path: "C:\\b.archive",
      prefixes: "tmp_",
      parallel: "3",
    });
    expect(initialDumpValues(database, { name: "Nightly", request })).toMatchObject({
      kind: "archive",
      path: "C:\\b.archive",
      prefixes: "tmp_",
      parallel: "3",
      save: true,
      name: "Nightly",
    });
    expect(initialDumpValues(database)).toMatchObject({ save: false, name: "Dump shop" });
  });
});
