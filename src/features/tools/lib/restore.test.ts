import type { DumpContents } from "@/shared/ipc/bindings";

import {
  buildRestoreRequest,
  canReplayOplog,
  databasesOf,
  initialRestoreValues,
  validateRestoreForm,
} from "./restore";

const contents: DumpContents = {
  gzip: true,
  oplog: true,
  namespaces: [
    { database: "crm", collection: "leads", view: false },
    { database: "shop", collection: "cheap", view: true },
    { database: "shop", collection: "items", view: false },
  ],
};

const values = { ...initialRestoreValues, kind: "archive" as const, path: " C:\\all.archive " };

describe("restore helpers", () => {
  it("groups namespaces by database", () => {
    expect(databasesOf(contents).map(([database, list]) => [database, list.length])).toEqual([
      ["crm", 1],
      ["shop", 2],
    ]);
  });

  it("replays the oplog only for a full restore under the same names", () => {
    expect(canReplayOplog(contents, values)).toBe(true);
    expect(canReplayOplog(contents, { ...values, renames: { shop: " shop " } })).toBe(true);
    expect(canReplayOplog(contents, { ...values, renames: { shop: "copy" } })).toBe(false);
    expect(canReplayOplog(contents, { ...values, excluded: ["crm.leads"] })).toBe(false);
    expect(canReplayOplog({ ...contents, oplog: false }, values)).toBe(false);
  });

  it("builds the request", () => {
    const request = buildRestoreRequest(
      { ...values, excluded: ["crm.leads"], renames: { shop: "copy", crm: "" }, parallel: "3" },
      contents,
    );
    expect(request).toEqual({
      source: { kind: "archive", path: "C:\\all.archive" },
      exclude: ["crm.leads"],
      renames: [{ from: "shop", to: "copy" }],
      drop: false,
      dryRun: false,
      oplogReplay: false,
      parallelCollections: 3,
    });
    expect(buildRestoreRequest(values, contents).oplogReplay).toBe(true);
  });

  it("asks for the dump and a valid parallelism", () => {
    expect(validateRestoreForm(initialRestoreValues).path).toBe("Choose the dump folder.");
    expect(validateRestoreForm({ ...values, parallel: "99" }).parallel).toMatch(/1 to 16/);
    expect(validateRestoreForm(values)).toEqual({});
  });
});
