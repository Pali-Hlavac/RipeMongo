import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { useTabsStore, WELCOME_TAB } from "@/features/workspace";
import { commands } from "@/shared/ipc/bindings";
import { ok, renderWithProviders } from "@/test/render";

import { newProfile } from "../../lib/defaults";
import { useExpandedConnections } from "../../store/expanded";
import { useSidebarFilter } from "../../store/filter";
import type { ActiveConnectionInfo, ConnectionProfile } from "../../types";
import { ConnectionSidebar } from "./ConnectionSidebar";

vi.mock("@/shared/ipc/bindings", () => ({
  commands: {
    listConnections: vi.fn(),
    listActiveConnections: vi.fn(),
    listDatabases: vi.fn(),
    listCollections: vi.fn(),
    collectionStats: vi.fn(),
  },
}));

const profile = (id: string): ConnectionProfile => {
  const base = newProfile();
  const hosts = [{ host: `${id}.example.com`, port: null }];
  return { ...base, id, name: id, config: { ...base.config, hosts } };
};

const active: ActiveConnectionInfo = {
  connectionId: "prod",
  viaSsh: false,
  server: {
    version: "8.0.4",
    topology: "standalone",
    replicaSetName: null,
    hosts: [],
    primary: null,
    writable: true,
  },
};

const collection = (name: string) => ({
  name,
  kind: "collection" as const,
  viewOn: null,
  capped: false,
  readOnly: false,
});

const COLLECTIONS: Record<string, string[]> = { shop: ["orders", "customers"], logs: ["events"] };

beforeEach(() => {
  useSidebarFilter.setState({ input: "" });
  useExpandedConnections.setState({ expanded: {} });
  useTabsStore.setState({ tabs: [WELCOME_TAB], activeTabId: WELCOME_TAB.id });
  vi.mocked(commands.listConnections).mockReturnValue(ok([profile("prod"), profile("local")]));
  vi.mocked(commands.listActiveConnections).mockReturnValue(ok([active]));
  vi.mocked(commands.listDatabases).mockReturnValue(
    ok([
      { name: "logs", sizeOnDisk: 0, empty: false },
      { name: "shop", sizeOnDisk: 0, empty: false },
    ]),
  );
  vi.mocked(commands.listCollections).mockImplementation((_, database) =>
    ok((COLLECTIONS[database] ?? []).map(collection)),
  );
  vi.mocked(commands.collectionStats).mockReturnValue(
    ok({ documentCount: 1, size: 1, storageSize: 1, indexSize: 1, averageDocumentSize: 1 }),
  );
});

const filterBox = () =>
  screen.findByRole("searchbox", { name: "Filter connections, databases and collections" });

describe("Sidebar filter", () => {
  it("shows only matches, opens their parents and highlights them", async () => {
    const user = userEvent.setup();
    renderWithProviders(<ConnectionSidebar />);

    await user.type(await filterBox(), "ord");
    const collections = await screen.findByRole("list", { name: "Collections in shop" });
    const orders = within(collections).getByRole("button", { name: /^orders/ });
    expect(orders.querySelector("mark")).toHaveTextContent("ord");
    expect(within(collections).queryByText("customers")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^logs/ })).not.toBeInTheDocument();
    expect(screen.queryByText("local")).not.toBeInTheDocument();

    await user.keyboard("{Enter}");
    expect(useTabsStore.getState().activeTabId).toBe("collection:prod:shop.orders");
  });

  it("moves between the box and the rows with the arrow keys; Escape clears", async () => {
    const user = userEvent.setup();
    renderWithProviders(<ConnectionSidebar />);
    const box = await filterBox();

    await user.type(box, "shop.");
    await screen.findByRole("list", { name: "Collections in shop" });
    await user.keyboard("{ArrowDown}");
    expect(screen.getByTitle("prod")).toHaveFocus();
    await user.keyboard("{ArrowDown}");
    expect(screen.getByRole("button", { name: /^shop/ })).toHaveFocus();
    await user.keyboard("{ArrowDown}");
    expect(screen.getByRole("button", { name: /^orders/ })).toHaveFocus();
    await user.keyboard("{Escape}");
    expect(box).toHaveFocus();
    expect(box).toHaveValue("");
    expect(await screen.findByText("local")).toBeInTheDocument();
  });

  it("matches connection names, says when nothing matches and is focused by its shortcut", async () => {
    const user = userEvent.setup();
    renderWithProviders(<ConnectionSidebar />);
    const box = await filterBox();

    await user.type(box, "loc");
    expect(await screen.findByText("loc")).toBeInTheDocument();
    // Kept with "Searching…" until its catalog has loaded and does not match.
    await waitFor(() => {
      expect(screen.queryByTitle("prod")).not.toBeInTheDocument();
    });

    await user.clear(box);
    await user.type(box, "zzz");
    const emptyState = (await screen.findByText("Nothing matches “zzz”")).parentElement;
    // The empty state's button; the box has its own clear button too.
    await user.click(
      within(emptyState ?? document.body).getByRole("button", { name: "Clear filter" }),
    );
    expect(box).toHaveValue("");

    box.blur();
    await user.keyboard("{Control>}{Shift>}f{/Shift}{/Control}");
    expect(box).toHaveFocus();
  });

  it("searches the collections of a limited number of databases", async () => {
    const names = Array.from({ length: 102 }, (_, index) => `db${String(index).padStart(3, "0")}`);
    vi.mocked(commands.listDatabases).mockReturnValue(
      ok(names.map((name) => ({ name, sizeOnDisk: 0, empty: false }))),
    );
    const user = userEvent.setup();
    renderWithProviders(<ConnectionSidebar />);

    await user.type(await filterBox(), "db");
    expect(
      await screen.findByText(/2 more databases were not searched/, undefined, { timeout: 3000 }),
    ).toBeInTheDocument();
    expect(commands.listCollections).toHaveBeenCalledTimes(100);

    // Nothing matches, but the skipped databases might hold it: the empty state says so.
    await user.type(await filterBox(), "zzz");
    expect(
      await screen.findByText(/2 databases were not searched \(too many\)/),
    ).toBeInTheDocument();
  });
});
