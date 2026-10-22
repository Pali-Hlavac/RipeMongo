import { IpcError } from "@/shared/ipc/client";

import { resolveStatus } from "./status";

vi.mock("@/shared/ipc/bindings", () => ({ commands: {} }));

describe("resolveStatus", () => {
  const failed = { state: "failed", error: new IpcError("CONNECTION_FAILED", "down") } as const;

  it("prefers an in-flight connect over everything", () => {
    expect(resolveStatus(true, { state: "connecting" })).toBe("connecting");
  });

  it("reports connected when the backend lists the connection", () => {
    expect(resolveStatus(true, undefined)).toBe("connected");
    expect(resolveStatus(true, failed)).toBe("connected");
  });

  it("reports the last failure, otherwise disconnected", () => {
    expect(resolveStatus(false, failed)).toBe("failed");
    expect(resolveStatus(false, undefined)).toBe("disconnected");
  });
});
