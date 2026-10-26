import { rankEntries, type NamespaceEntry } from "./goto";

const entry = (database: string, collection: string, connectionId = "c1"): NamespaceEntry => ({
  connectionId,
  connectionName: connectionId === "c1" ? "Local" : "Production",
  database,
  collection,
  kind: "collection",
});

const entries = [
  entry("shop", "orders"),
  entry("shop", "customers"),
  entry("archive", "old_orders"),
  entry("orders_db", "items"),
  entry("shop", "orders", "c2"),
];

const names = (list: NamespaceEntry[]) =>
  list.map((item) => `${item.connectionId}:${item.database}.${item.collection}`);

describe("rankEntries", () => {
  it("lists everything by name without a query, recently opened first", () => {
    const { recent, others } = rankEntries(entries, "", [
      { connectionId: "c1", database: "shop", collection: "customers" },
      { connectionId: "c1", database: "gone", collection: "dropped" },
    ]);
    expect(names(recent)).toEqual(["c1:shop.customers"]);
    expect(names(others)).toEqual([
      "c1:archive.old_orders",
      "c1:orders_db.items",
      "c1:shop.orders",
      "c2:shop.orders",
    ]);
  });

  it("ranks collection-name matches by score above database-name matches", () => {
    const { others } = rankEntries(entries, "orders", []);
    expect(names(others)).toEqual([
      "c1:shop.orders",
      "c2:shop.orders",
      "c1:archive.old_orders",
      "c1:orders_db.items",
    ]);
    expect(others[0]?.collectionRanges).toEqual([[0, 6]]);
    expect(others[3]?.databaseRanges).toEqual([[0, 6]]);
  });

  it("narrows database.collection", () => {
    const { others } = rankEntries(entries, "sh.ord", []);
    expect(names(others)).toEqual(["c1:shop.orders", "c2:shop.orders"]);
    expect(others[0]?.databaseRanges).toEqual([[0, 2]]);
  });
});
