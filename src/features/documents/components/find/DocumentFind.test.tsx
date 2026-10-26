import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { commands } from "@/shared/ipc/bindings";
import { ok, renderWithProviders } from "@/test/render";

import { DEFAULT_VIEW_STATE, useCollectionViewStore, type DocumentView } from "../../store/view";
import { CollectionDocuments } from "../CollectionDocuments";

vi.mock("@/shared/ipc/bindings", () => ({
  commands: {
    findDocuments: vi.fn(),
    countDocuments: vi.fn(),
    listQueries: vi.fn(),
    recordQuery: vi.fn(),
  },
}));

const documents = [
  { name: "Bratislava office", address: { city: "Bratislava" } },
  { name: "Košice", note: "near Bratislava" },
].map((document) => JSON.stringify(document));

const target = {
  tabId: "t1",
  connectionId: "c1",
  database: "shop",
  collection: "offices",
  readOnly: true,
};

beforeEach(() => {
  useCollectionViewStore.setState({ states: {} });
  vi.mocked(commands.findDocuments).mockReturnValue(ok({ documents, hasMore: false }));
  vi.mocked(commands.countDocuments).mockReturnValue(ok({ count: 2, estimated: false }));
  vi.mocked(commands.listQueries).mockReturnValue(ok({ recent: [], favorites: [] }));
});

const current = () => document.querySelector("[data-find-current]");

const showView = (view: DocumentView) => {
  useCollectionViewStore.setState({ states: { t1: { ...DEFAULT_VIEW_STATE, view } } });
};

describe("Find on this page", () => {
  it("highlights hits, opens nested fields and steps through them", async () => {
    const user = userEvent.setup();
    renderWithProviders(<CollectionDocuments {...target} />);
    await screen.findByRole("listitem", { name: "Document 1" });

    await user.keyboard("{Control>}f{/Control}");
    const box = screen.getByRole("textbox", { name: "Find on this page" });
    expect(box).toHaveFocus();
    expect(
      screen.getByText(/Searches only the 2 documents on this page, not the collection/),
    ).toBeInTheDocument();

    await user.type(box, "bratislava");
    const search = screen.getByRole("search", { name: "Find on this page" });
    expect(within(search).getByText("1 of 3")).toBeInTheDocument();
    // The nested city opened by itself; every hit is marked.
    expect(screen.getAllByText(/bratislava/i, { selector: "mark" })).toHaveLength(3);
    expect(current()?.closest("li")).toHaveTextContent("name:");

    await user.keyboard("{Enter}");
    expect(within(search).getByText("2 of 3")).toBeInTheDocument();
    expect(current()?.closest("li")).toHaveTextContent("city:");
    await user.keyboard("{Shift>}{Enter}{/Shift}{Shift>}{Enter}{/Shift}");
    expect(within(search).getByText("3 of 3")).toBeInTheDocument();
    expect(current()?.closest("li")).toHaveTextContent("note:");

    await user.clear(box);
    await user.type(box, "zzz");
    expect(within(search).getByText("No matches")).toBeInTheDocument();
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("search", { name: "Find on this page" })).not.toBeInTheDocument();
    expect(document.querySelector("mark")).toBeNull();
  });

  it("finds in the JSON view text and opens from the toolbar", async () => {
    showView("json");
    const user = userEvent.setup();
    renderWithProviders(<CollectionDocuments {...target} />);
    await screen.findByRole("listitem", { name: "Document 1" });

    await user.click(screen.getByRole("button", { name: /Find on this page/ }));
    await user.type(screen.getByRole("textbox", { name: "Find on this page" }), "city");
    expect(screen.getByText("1 of 1")).toBeInTheDocument();
    expect(current()).toHaveTextContent("city");
  });

  it("finds in the table cells", async () => {
    // jsdom has no layout; give the table's scroll area a size so rows stay rendered.
    vi.spyOn(HTMLElement.prototype, "clientHeight", "get").mockReturnValue(600);
    vi.spyOn(HTMLElement.prototype, "clientWidth", "get").mockReturnValue(1000);
    showView("table");
    const user = userEvent.setup();
    renderWithProviders(<CollectionDocuments {...target} />);
    await screen.findByRole("table", { name: "Documents" });
    await user.keyboard("{Control>}f{/Control}");
    await user.type(screen.getByRole("textbox", { name: "Find on this page" }), "bratislava");
    // The nested city is shown as "{ 1 field }" in its cell, so two cells match.
    expect(screen.getByText("1 of 2")).toBeInTheDocument();
    expect(current()?.closest('[role="cell"]')).toHaveTextContent("Bratislava office");
    await user.keyboard("{Enter}");
    expect(current()?.closest('[role="cell"]')).toHaveTextContent("near Bratislava");
  });
});
