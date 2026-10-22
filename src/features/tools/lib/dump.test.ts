import { buildDumpRequest, defaultArchiveName, dumpScope } from "./dump";

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

  it("builds the request with a trimmed path", () => {
    expect(buildDumpRequest(database, "folder", "  C:\\dumps ", false)).toEqual({
      database: "shop",
      collection: null,
      output: { kind: "folder", path: "C:\\dumps" },
      gzip: false,
    });
  });
});
