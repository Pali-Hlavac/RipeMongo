import { formatHotkey, matchesHotkey, parseHotkey } from "./hotkeys";

const keyEvent = (key: string, modifiers: Partial<KeyboardEvent> = {}) => ({
  key,
  ctrlKey: false,
  metaKey: false,
  shiftKey: false,
  altKey: false,
  ...modifiers,
});

describe("parseHotkey", () => {
  it("maps mod to meta on macOS and ctrl elsewhere", () => {
    expect(parseHotkey("mod+k", true)).toMatchObject({ key: "k", meta: true, ctrl: false });
    expect(parseHotkey("mod+k", false)).toMatchObject({ key: "k", meta: false, ctrl: true });
  });
});

describe("matchesHotkey", () => {
  it("matches the exact combo case-insensitively", () => {
    expect(matchesHotkey(keyEvent("K", { ctrlKey: true }), "mod+k", false)).toBe(true);
  });

  it("rejects extra modifiers", () => {
    expect(matchesHotkey(keyEvent("k", { ctrlKey: true, shiftKey: true }), "mod+k", false)).toBe(
      false,
    );
  });

  it("rejects the wrong platform modifier", () => {
    expect(matchesHotkey(keyEvent("k", { ctrlKey: true }), "mod+k", true)).toBe(false);
  });
});

describe("formatHotkey", () => {
  it("uses symbols on macOS", () => {
    expect(formatHotkey("mod+shift+p", true)).toBe("⌘⇧P");
  });

  it("uses words elsewhere", () => {
    expect(formatHotkey("mod+shift+p", false)).toBe("Ctrl+Shift+P");
  });
});
