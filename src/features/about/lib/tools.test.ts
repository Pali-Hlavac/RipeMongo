import { summarizeTools } from "./tools";

describe("summarizeTools", () => {
  it("reports one version when every tool is present", () => {
    const info = {
      tools: [
        { tool: "mongodump" as const, version: "100.19.1" },
        { tool: "mongorestore" as const, version: "100.19.1" },
      ],
    };
    expect(summarizeTools(info)).toEqual({ version: "100.19.1", missing: [] });
  });

  it("lists missing tools", () => {
    const info = {
      tools: [
        { tool: "mongodump" as const, version: null },
        { tool: "mongoimport" as const, version: "100.19.1" },
      ],
    };
    expect(summarizeTools(info)).toEqual({ version: "100.19.1", missing: ["mongodump"] });
    expect(summarizeTools({ tools: [{ tool: "mongodump", version: null }] }).version).toBeNull();
  });
});
