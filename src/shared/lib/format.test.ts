import { formatBytes } from "./format";

describe("formatBytes", () => {
  it.each([
    [0, "0 B"],
    [512, "512 B"],
    [1536, "1.5 KB"],
    [15 * 1024 * 1024, "15 MB"],
    [3.25 * 1024 ** 3, "3.3 GB"],
  ])("%d bytes → %s", (bytes, expected) => {
    expect(formatBytes(bytes)).toBe(expected);
  });
});
