import type { CatalogSearch } from "@/features/catalog";

import type { ConnectionProfile } from "../types";
import { newProfile } from "./defaults";
import { matchConnections } from "./filter";

const profile = (id: string, extra: Partial<ConnectionProfile> = {}): ConnectionProfile => ({
  ...newProfile(),
  id,
  name: id,
  ...extra,
});

const profiles = [
  profile("Production", { folder: "Customers", color: "red" }),
  profile("Staging", {
    config: { ...newProfile().config, hosts: [{ host: "db.staging.example.com", port: null }] },
  }),
  profile("Local"),
];

const search = (databases: string[], searching = false): CatalogSearch => ({
  databases: new Map(
    databases.map((name) => [
      name,
      { ranges: [], collections: new Map(), showAll: true, expand: false },
    ]),
  ),
  notSearched: 0,
  searching,
});

const match = (input: string, searches = new Map<string, CatalogSearch>()) =>
  matchConnections(profiles, input, searches);

describe("matchConnections", () => {
  it("matches the name, folder, a host or the color label", () => {
    expect(match("prod").get("Production")).toEqual({ ranges: [[0, 4]], self: true });
    expect([...match("customers").keys()]).toEqual(["Production"]);
    expect([...match("staging.example").keys()]).toEqual(["Staging"]);
    expect([...match("RED").keys()]).toEqual(["Production"]);
    expect(match("zzz").size).toBe(0);
  });

  it("keeps a connection whose catalog matches and filters its tree", () => {
    const searches = new Map([["Local", search(["inventory"])]]);
    const local = match("inv", searches).get("Local");
    expect(local?.self).toBe(false);
    expect(local?.tree?.search.databases.has("inventory")).toBe(true);
    // A connection that matched by itself shows its whole tree when nothing inside matches.
    const own = match("loc", new Map([["Local", search([])]])).get("Local");
    expect(own).toEqual({ ranges: [[0, 3]], self: true, tree: undefined });
  });

  it("keeps a connected connection while its catalog is still loading", () => {
    const local = match("inv", new Map([["Local", search([], true)]])).get("Local");
    expect(local?.tree?.search.searching).toBe(true);
  });

  it("matches database.collection inside connections, and hosts with dots", () => {
    expect(match("prod.x").size).toBe(0);
    const searches = new Map([["Staging", search(["shop"])]]);
    expect([...match("sh.ord", searches).keys()]).toEqual(["Staging"]);
  });
});
