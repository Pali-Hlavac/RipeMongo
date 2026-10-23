import { fireEvent, renderHook } from "@testing-library/react";

import { useTabsStore } from "../store/tabs";
import { useTabHotkeys } from "./useTabHotkeys";

const tab = (id: string) => ({ id, kind: "connection" as const, connectionId: id, title: id });

beforeEach(() => {
  useTabsStore.setState({ tabs: [tab("a"), tab("b")], activeTabId: "a" });
});

describe("useTabHotkeys", () => {
  it("cycles tabs, but not while a dialog is open", () => {
    renderHook(() => {
      useTabHotkeys();
    });
    fireEvent.keyDown(window, { key: "Tab", ctrlKey: true });
    expect(useTabsStore.getState().activeTabId).toBe("b");

    const dialog = document.createElement("div");
    dialog.setAttribute("role", "dialog");
    document.body.append(dialog);
    fireEvent.keyDown(window, { key: "Tab", ctrlKey: true });
    expect(useTabsStore.getState().activeTabId).toBe("b");
    dialog.remove();
  });
});
