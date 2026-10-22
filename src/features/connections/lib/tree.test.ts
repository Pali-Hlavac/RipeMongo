import type { ConnectionProfile } from "../types";
import { newProfile } from "./defaults";
import { buildConnectionTree, folderNames } from "./tree";

const profile = (name: string, extra: Partial<ConnectionProfile> = {}): ConnectionProfile => ({
  ...newProfile(),
  id: name,
  name,
  ...extra,
});

describe("buildConnectionTree", () => {
  const profiles = [
    profile("zeta"),
    profile("Prod EU", { folder: "Production", favorite: true }),
    profile("alpha"),
    profile("Prod US", { folder: "Production" }),
    profile("Staging", { folder: " Dev " }),
  ];

  it("sorts ungrouped connections by name, case-insensitively", () => {
    expect(buildConnectionTree(profiles).ungrouped.map((p) => p.name)).toEqual(["alpha", "zeta"]);
  });

  it("groups by trimmed folder name and sorts folders", () => {
    const { folders } = buildConnectionTree(profiles);
    expect(folders.map((f) => f.name)).toEqual(["Dev", "Production"]);
    expect(folders[1]?.connections.map((p) => p.name)).toEqual(["Prod EU", "Prod US"]);
  });

  it("lists favorites separately while keeping them in their folder", () => {
    expect(buildConnectionTree(profiles).favorites.map((p) => p.name)).toEqual(["Prod EU"]);
  });

  it("collects distinct folder names", () => {
    expect(folderNames(profiles)).toEqual(["Dev", "Production"]);
  });
});
