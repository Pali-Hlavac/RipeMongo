import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { useTabsStore, WELCOME_TAB } from "@/features/workspace";
import { commands } from "@/shared/ipc/bindings";
import { ok, renderWithProviders } from "@/test/render";

import { useCatalogDialogs } from "../../store/dialogs";
import { useExpandedDatabases } from "../../store/expanded";
import { DatabaseTree } from "./DatabaseTree";

vi.mock("@/shared/ipc/bindings", () => ({
  commands: { listDatabases: vi.fn(), listCollections: vi.fn(), collectionStats: vi.fn() },
}));

const stats = {
  documentCount: 12_345,
  size: 1024,
  storageSize: 4096,
  indexSize: 2048,
  averageDocumentSize: 64,
};

beforeEach(() => {
  useExpandedDatabases.setState({ expanded: {} });
  useCatalogDialogs.setState({ dialog: null });
  useTabsStore.setState({ tabs: [WELCOME_TAB], activeTabId: WELCOME_TAB.id });
  vi.mocked(commands.listDatabases).mockReturnValue(
    ok([
      { name: "admin", sizeOnDisk: 40_960, empty: false },
      { name: "shop", sizeOnDisk: 15 * 1024 * 1024, empty: false },
    ]),
  );
  vi.mocked(commands.listCollections).mockReturnValue(
    ok([
      { name: "orders", kind: "collection", viewOn: null, capped: false, readOnly: false },
      { name: "openOrders", kind: "view", viewOn: "orders", capped: false, readOnly: true },
    ]),
  );
  vi.mocked(commands.collectionStats).mockReturnValue(ok(stats));
});

describe("DatabaseTree", () => {
  it("lists databases with sizes and expands one into its collections", async () => {
    const user = userEvent.setup();
    renderWithProviders(<DatabaseTree connectionId="c1" label="Databases in Local" />);

    const databases = await screen.findByRole("list", { name: "Databases in Local" });
    const shop = within(databases).getByRole("button", { name: /^shop/ });
    expect(shop).toHaveTextContent("15 MB");
    expect(shop).toHaveAttribute("aria-expanded", "false");

    await user.click(shop);
    const collections = await screen.findByRole("list", { name: "Collections in shop" });
    expect(within(collections).getByText("orders")).toBeInTheDocument();
    expect(
      within(collections).getByRole("button", { name: /^openOrders ?\(view\)/ }),
    ).toBeInTheDocument();
    expect(await within(collections).findByText("12.3K")).toBeInTheDocument();
    expect(commands.listCollections).toHaveBeenCalledWith("c1", "shop");
    // Views have no storage statistics.
    expect(commands.collectionStats).toHaveBeenCalledTimes(1);
    expect(commands.collectionStats).toHaveBeenCalledWith("c1", "shop", "orders");
  });

  it("opens a collection tab on click and marks it current", async () => {
    useExpandedDatabases.getState().toggle("c1", "shop");
    const user = userEvent.setup();
    renderWithProviders(<DatabaseTree connectionId="c1" label="Databases" />);

    const orders = await screen.findByRole("button", { name: /^orders/ });
    await user.click(orders);

    expect(useTabsStore.getState().activeTabId).toBe("collection:c1:shop.orders");
    expect(useTabsStore.getState().tabs.at(-1)).toMatchObject({
      kind: "collection",
      database: "shop",
      collection: "orders",
      title: "orders",
    });
    expect(orders).toHaveAttribute("aria-current", "page");
  });

  it("opens the drop dialog from a collection's menu", async () => {
    useExpandedDatabases.getState().toggle("c1", "shop");
    const user = userEvent.setup();
    renderWithProviders(<DatabaseTree connectionId="c1" label="Databases" />);

    await user.click(await screen.findByRole("button", { name: "Actions for openOrders" }));
    expect(screen.queryByRole("menuitem", { name: /rename/i })).not.toBeInTheDocument();
    await user.click(screen.getByRole("menuitem", { name: /drop view/i }));

    expect(useCatalogDialogs.getState().dialog).toEqual({
      type: "dropCollection",
      connectionId: "c1",
      database: "shop",
      collection: "openOrders",
      kind: "view",
    });
  });

  it("shows an inline error with retry", async () => {
    vi.mocked(commands.listDatabases).mockReturnValue(
      Promise.resolve({
        status: "error" as const,
        error: { code: "NOT_CONNECTED" as const, message: "Not connected.", hint: null },
      }),
    );
    renderWithProviders(<DatabaseTree connectionId="c1" label="Databases" />);

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Not connected.");
    expect(within(alert).getByRole("button", { name: "Retry" })).toBeInTheDocument();
  });
});
