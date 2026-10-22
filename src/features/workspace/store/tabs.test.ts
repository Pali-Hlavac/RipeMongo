import type { WorkspaceTab } from "../types";

import { WELCOME_TAB, useTabsStore } from "./tabs";

const tab = (id: string): WorkspaceTab => ({ id, kind: "welcome", title: id });
const state = () => useTabsStore.getState();

beforeEach(() => {
  useTabsStore.setState({ tabs: [WELCOME_TAB], activeTabId: WELCOME_TAB.id });
});

describe("tabs store", () => {
  it("opens and activates a new tab", () => {
    state().openTab(tab("a"));
    expect(state().tabs.map((t) => t.id)).toEqual(["welcome", "a"]);
    expect(state().activeTabId).toBe("a");
  });

  it("focuses instead of duplicating an already open tab", () => {
    state().openTab(tab("a"));
    state().openTab(WELCOME_TAB);
    expect(state().tabs).toHaveLength(2);
    expect(state().activeTabId).toBe("welcome");
  });

  it("activates the right neighbor when closing the active tab", () => {
    state().openTab(tab("a"));
    state().openTab(tab("b"));
    state().activateTab("a");
    state().closeTab("a");
    expect(state().activeTabId).toBe("b");
  });

  it("falls back to the last tab when closing the active last tab", () => {
    state().openTab(tab("a"));
    state().closeTab("a");
    expect(state().activeTabId).toBe("welcome");
  });

  it("keeps the active tab when closing another one", () => {
    state().openTab(tab("a"));
    state().closeTab("welcome");
    expect(state().activeTabId).toBe("a");
  });

  it("clears the active tab when the last tab closes", () => {
    state().closeTab("welcome");
    expect(state().tabs).toEqual([]);
    expect(state().activeTabId).toBeNull();
  });

  it("cycles with wrap-around in both directions", () => {
    state().openTab(tab("a"));
    state().cycleTab(1);
    expect(state().activeTabId).toBe("welcome");
    state().cycleTab(-1);
    expect(state().activeTabId).toBe("a");
  });
});
