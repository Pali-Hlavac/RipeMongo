import { dumpProfile, dumpRequest } from "../test/fixtures";
import { dumpOptionsSummary, lastRunLabel, profileScope } from "./profiles";

describe("saved dump helpers", () => {
  it("describes what and where", () => {
    expect(profileScope(dumpProfile())).toBe("shop on Local dev");
    const server = dumpProfile({ request: dumpRequest({ database: null }) });
    expect(profileScope(server)).toBe("all databases on Local dev");
  });

  it("summarizes the options", () => {
    expect(dumpOptionsSummary(dumpRequest())).toBe("Folder");
    const request = dumpRequest({
      output: { kind: "archive", path: "C:\\a" },
      gzip: true,
      query: "{ a: 1 }",
      oplog: true,
      excludeCollections: ["logs"],
      excludePrefixes: ["tmp_"],
      parallelCollections: 2,
    });
    expect(dumpOptionsSummary(request)).toBe(
      "Archive · gzip · filtered · oplog · 2 exclusions · 2 at a time",
    );
  });

  it("labels the last run", () => {
    expect(lastRunLabel(dumpProfile())).toBe("Never run");
    const ran = dumpProfile({ lastRunAt: "2026-10-22T21:00:00Z" });
    expect(lastRunLabel(ran, "en-GB")).toMatch(/^Last run 22 Oct 2026/);
  });
});
