import type { CollectionInfo } from "../types";
import {
  databaseCandidate,
  matchDatabases,
  parseSidebarFilter,
  type SidebarFilter,
} from "./filter";

const collection = (name: string): CollectionInfo => ({
  name,
  kind: "collection",
  viewOn: null,
  capped: false,
  readOnly: false,
});

const database = (name: string, collections?: string[]) => ({
  info: { name, sizeOnDisk: 0, empty: false },
  collections: collections?.map(collection),
});

const catalog = [
  database("shop", ["orders", "customers", "orderItems"]),
  database("analytics", ["events", "shop_visits"]),
  database("logs"),
];

const parse = (input: string): SidebarFilter => {
  const filter = parseSidebarFilter(input);
  if (!filter) throw new Error("expected a filter");
  return filter;
};

describe("parseSidebarFilter", () => {
  it("splits database.collection at the first dot", () => {
    expect(parseSidebarFilter("  ")).toBeNull();
    expect(parseSidebarFilter(" ord ")).toEqual({ kind: "text", text: "ord" });
    expect(parseSidebarFilter("shop.ord.archive")).toEqual({
      kind: "namespace",
      database: "shop",
      collection: "ord.archive",
    });
    expect(parseSidebarFilter(".ord")).toEqual({
      kind: "namespace",
      database: "",
      collection: "ord",
    });
  });
});

describe("matchDatabases", () => {
  it("keeps databases whose name or collections match plain text", () => {
    const matches = matchDatabases(parse("shop"), catalog);
    expect([...matches.keys()]).toEqual(["shop", "analytics"]);
    const shop = matches.get("shop");
    expect(shop).toMatchObject({ ranges: [[0, 4]], showAll: true, expand: false });
    const analytics = matches.get("analytics");
    expect(analytics?.expand).toBe(true);
    expect([...(analytics?.collections.keys() ?? [])]).toEqual(["shop_visits"]);
  });

  it("opens a database whose collections match and shows only those", () => {
    const shop = matchDatabases(parse("order"), catalog).get("shop");
    expect(shop?.showAll).toBe(false);
    expect(shop?.expand).toBe(true);
    expect(shop?.collections).toEqual(
      new Map([
        ["orders", [[0, 5]]],
        ["orderItems", [[0, 5]]],
      ]),
    );
  });

  it("matches a database name without loaded collections", () => {
    expect(matchDatabases(parse("log"), catalog).get("logs")?.showAll).toBe(true);
  });

  it("narrows database.collection to collections in matching databases", () => {
    const matches = matchDatabases(parse("sh.cust"), catalog);
    expect([...matches.keys()]).toEqual(["shop"]);
    expect([...(matches.get("shop")?.collections.keys() ?? [])]).toEqual(["customers"]);
    // An empty collection part lists every collection of the matching databases.
    expect(matchDatabases(parse("ana."), catalog).get("analytics")?.collections.size).toBe(2);
    // Collections that are not loaded cannot match.
    expect(matchDatabases(parse("logs."), catalog).size).toBe(0);
  });

  it("knows which databases a filter targets", () => {
    expect(databaseCandidate(parse("x"), "anything")).toBe(true);
    expect(databaseCandidate(parse("sh.x"), "shop")).toBe(true);
    expect(databaseCandidate(parse("sh.x"), "logs")).toBe(false);
  });
});
