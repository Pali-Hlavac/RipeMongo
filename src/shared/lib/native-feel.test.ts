import { installNativeFeel } from "./native-feel";

beforeAll(() => {
  installNativeFeel();
});

function dispatch(target: EventTarget, event: Event): boolean {
  target.dispatchEvent(event);
  return event.defaultPrevented;
}

describe("installNativeFeel", () => {
  it("blocks the context menu on regular elements", () => {
    const div = document.body.appendChild(document.createElement("div"));
    expect(dispatch(div, new MouseEvent("contextmenu", { bubbles: true, cancelable: true }))).toBe(
      true,
    );
  });

  it("keeps the context menu on inputs", () => {
    const input = document.body.appendChild(document.createElement("input"));
    expect(
      dispatch(input, new MouseEvent("contextmenu", { bubbles: true, cancelable: true })),
    ).toBe(false);
  });

  it("blocks reload but not ordinary shortcuts", () => {
    const reload = new KeyboardEvent("keydown", { key: "r", ctrlKey: true, cancelable: true });
    const copy = new KeyboardEvent("keydown", { key: "c", ctrlKey: true, cancelable: true });
    expect(dispatch(window, reload)).toBe(true);
    expect(dispatch(window, copy)).toBe(false);
  });
});
