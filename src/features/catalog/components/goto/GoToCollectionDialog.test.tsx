import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { useTabsStore, WELCOME_TAB } from "@/features/workspace";
import { commands } from "@/shared/ipc/bindings";
import { ok, renderWithProviders } from "@/test/render";

import { openCollectionTab } from "../../lib/tabs";
import { useGoToCollection } from "../../store/goto";
import { useRecentCollections } from "../../store/recent";
import { GoToCollectionDialog } from "./GoToCollectionDialog";

vi.mock("@/shared/ipc/bindings", () => ({
  commands: { listDatabases: vi.fn(), listCollections: vi.fn() },
}));

const collection = (name: string, kind: "collection" | "view" = "collection") => ({
  name,
  kind,
  viewOn: null,
  capped: false,
  readOnly: false,
});

const COLLECTIONS: Record<string, ReturnType<typeof collection>[]> = {
  shop: [collection("orders"), collection("customers"), collection("paid", "view")],
  logs: [collection("events")],
};

const connections = [
  { id: "c1", name: "Local" },
  { id: "c2", name: "Production" },
];

beforeEach(() => {
  useGoToCollection.setState({ open: false });
  useRecentCollections.setState({ recent: [] });
  useTabsStore.setState({ tabs: [WELCOME_TAB], activeTabId: WELCOME_TAB.id });
  vi.mocked(commands.listDatabases).mockImplementation((connectionId) =>
    ok(
      (connectionId === "c1" ? ["logs", "shop"] : ["shop"]).map((name) => ({
        name,
        sizeOnDisk: 0,
        empty: false,
      })),
    ),
  );
  vi.mocked(commands.listCollections).mockImplementation((_, database) =>
    ok(COLLECTIONS[database] ?? []),
  );
});

describe("GoToCollectionDialog", () => {
  it("opens with Ctrl+P, finds collections of every connection and opens the chosen one", async () => {
    const user = userEvent.setup();
    renderWithProviders(<GoToCollectionDialog connections={connections} />);

    await user.keyboard("{Control>}p{/Control}");
    const dialog = await screen.findByRole("dialog", { name: "Go to collection" });
    await user.type(within(dialog).getByRole("combobox"), "ord");
    const options = await within(dialog).findAllByRole("option");
    expect(options.map((option) => option.textContent)).toEqual([
      "ordersshop · Local",
      "ordersshop · Production",
    ]);

    await user.keyboard("{ArrowDown}{Enter}");
    expect(useTabsStore.getState().activeTabId).toBe("collection:c2:shop.orders");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("lists recently opened collections first", async () => {
    const user = userEvent.setup();
    renderWithProviders(<GoToCollectionDialog connections={connections.slice(0, 1)} />);
    openCollectionTab("c1", "logs", "events");
    openCollectionTab("c1", "shop", "paid");

    useGoToCollection.getState().setOpen(true);
    const recent = await screen.findByRole("group", { name: "Recently opened" });
    expect(
      within(recent)
        .getAllByRole("option")
        .map((option) => option.textContent),
    ).toEqual(["paid(view)shop", "eventslogs"]);
    expect(await screen.findByRole("option", { name: /customers/ })).toBeInTheDocument();

    await user.type(screen.getByRole("combobox"), "zzz");
    expect(await screen.findByText("No matching collections.")).toBeInTheDocument();
  });

  it("asks to connect when nothing is connected", async () => {
    renderWithProviders(<GoToCollectionDialog connections={[]} />);
    useGoToCollection.getState().setOpen(true);
    expect(
      await screen.findByText("Connect to a server to go to its collections."),
    ).toBeInTheDocument();
  });
});
