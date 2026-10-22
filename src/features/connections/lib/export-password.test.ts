import { MIN_EXPORT_PASSWORD_LENGTH, exportPasswordProblem } from "./export-password";

describe("exportPasswordProblem", () => {
  it("requires a minimum length", () => {
    expect(exportPasswordProblem("short", "short")).toMatch(String(MIN_EXPORT_PASSWORD_LENGTH));
  });

  it("requires the confirmation to match", () => {
    expect(exportPasswordProblem("long enough", "different")).toMatch(/do not match/);
  });

  it("accepts a long, confirmed password", () => {
    expect(exportPasswordProblem("long enough", "long enough")).toBeNull();
  });
});
