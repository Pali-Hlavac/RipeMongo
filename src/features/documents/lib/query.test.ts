import { EMPTY_QUERY } from "../store/view";
import { describeQuery, pageHasMore, pageWindow, visibleCount } from "./query";

const query = (skip: number, limit: number) => ({ ...EMPTY_QUERY, skip, limit });

describe("pageWindow", () => {
  it("adds the query's skip to the pager offset", () => {
    expect(pageWindow(query(0, 0), 40, 20)).toEqual({ skip: 40, limit: 20 });
    expect(pageWindow(query(5, 0), 40, 20)).toEqual({ skip: 45, limit: 20 });
  });

  it("shortens the last page to respect the query's limit", () => {
    expect(pageWindow(query(0, 50), 40, 20)).toEqual({ skip: 40, limit: 10 });
  });
});

describe("pageHasMore", () => {
  it("stops at the query's limit even when the server has more", () => {
    expect(pageHasMore(query(0, 50), 40, 10, true)).toBe(false);
    expect(pageHasMore(query(0, 50), 20, 20, true)).toBe(true);
    expect(pageHasMore(query(0, 0), 20, 20, false)).toBe(false);
  });
});

describe("visibleCount", () => {
  it("subtracts the skip and caps by the limit", () => {
    const count = { count: 100, estimated: false };
    expect(visibleCount(query(30, 0), count)).toEqual({ count: 70, estimated: false });
    expect(visibleCount(query(30, 50), count)).toEqual({ count: 50, estimated: false });
    expect(visibleCount(query(0, 0), undefined)).toBeUndefined();
  });
});

describe("describeQuery", () => {
  it("summarizes the non-empty parts", () => {
    expect(describeQuery({ filter: "", projection: "", sort: "{ a: 1 }", collation: "" })).toBe(
      "{} · sort { a: 1 }",
    );
  });
});
