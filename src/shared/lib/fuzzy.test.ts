import { fuzzyMatch, isWordStart } from "./fuzzy";

describe("fuzzyMatch", () => {
  it("matches everything for an empty query", () => {
    expect(fuzzyMatch("  ", "orders")).toEqual({ score: 0, ranges: [] });
  });

  it("finds the query anywhere, ignoring case, and ranks prefixes and word starts first", () => {
    const prefix = fuzzyMatch("ORD", "orders");
    const wordStart = fuzzyMatch("ord", "openOrders");
    const inside = fuzzyMatch("der", "orders");
    expect(prefix?.ranges).toEqual([[0, 3]]);
    expect(wordStart?.ranges).toEqual([[4, 7]]);
    expect(inside?.ranges).toEqual([[2, 5]]);
    expect(prefix?.score).toBeGreaterThan(wordStart?.score ?? 0);
    expect(wordStart?.score).toBeGreaterThan(inside?.score ?? 0);
  });

  it("prefers an occurrence that starts a word", () => {
    expect(fuzzyMatch("log", "catalog_logs")?.ranges).toEqual([[8, 11]]);
  });

  it("matches chunks that start words", () => {
    expect(fuzzyMatch("oi", "orderItems")?.ranges).toEqual([
      [0, 1],
      [5, 6],
    ]);
    expect(fuzzyMatch("usrpro", "user_profiles")).toBeNull();
    expect(fuzzyMatch("uspro", "user_profiles")?.ranges).toEqual([
      [0, 2],
      [5, 8],
    ]);
    expect(fuzzyMatch("ord", "oxrxd")).toBeNull();
    const chunked = fuzzyMatch("sl", "system_logs");
    expect(chunked?.score).toBeLessThan(fuzzyMatch("sys", "system_logs")?.score ?? 0);
  });

  it("backtracks when the first placement leads nowhere", () => {
    expect(fuzzyMatch("abcd", "abc_xab_cd")?.ranges).toEqual([
      [0, 2],
      [8, 10],
    ]);
    expect(fuzzyMatch("cart", "carrot_tracker")?.ranges).toEqual([
      [0, 3],
      [7, 8],
    ]);
  });
});

describe("isWordStart", () => {
  it("knows separators, case changes and digits", () => {
    expect(isWordStart("user_profiles", 5)).toBe(true);
    expect(isWordStart("orderItems", 5)).toBe(true);
    expect(isWordStart("orderItems", 4)).toBe(false);
    expect(isWordStart("logs2024", 4)).toBe(true);
    expect(isWordStart("ORDERS", 1)).toBe(false);
  });
});
