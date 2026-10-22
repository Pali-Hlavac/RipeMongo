import { IPC_FAILURE, IpcError, call, isAppError, toIpcError, unwrap } from "./client";

vi.mock("./bindings", () => ({ commands: {} }));

describe("isAppError", () => {
  it("accepts the backend error shape", () => {
    expect(isAppError({ code: "IO", message: "x", hint: null })).toBe(true);
  });

  it.each([null, "text", 42, { message: "no code" }])("rejects %p", (value) => {
    expect(isAppError(value)).toBe(false);
  });
});

describe("toIpcError", () => {
  it("keeps backend code, message and hint", () => {
    const error = toIpcError({ code: "INVALID_DATA", message: "bad", hint: "fix" });
    expect(error).toMatchObject({ code: "INVALID_DATA", message: "bad", hint: "fix" });
  });

  it("wraps framework string rejections", () => {
    expect(toIpcError("command not allowed")).toMatchObject({
      code: IPC_FAILURE,
      message: "command not allowed",
    });
  });

  it("returns existing IpcError instances unchanged", () => {
    const original = new IpcError("IO", "disk");
    expect(toIpcError(original)).toBe(original);
  });
});

describe("unwrap", () => {
  it("returns data for ok results", async () => {
    await expect(unwrap(Promise.resolve({ status: "ok", data: 5 }))).resolves.toBe(5);
  });

  it("throws IpcError for error results", async () => {
    const pending = unwrap(
      Promise.resolve({ status: "error", error: { code: "IO", message: "m", hint: null } }),
    );
    await expect(pending).rejects.toMatchObject({ name: "IpcError", code: "IO" });
  });
});

describe("call", () => {
  it("normalizes rejections", async () => {
    await expect(call(Promise.reject(new Error("boom")))).rejects.toMatchObject({
      code: IPC_FAILURE,
      message: "boom",
    });
  });
});
