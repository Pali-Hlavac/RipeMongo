import { act, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { useTabsStore, WELCOME_TAB } from "@/features/workspace";
import { commands } from "@/shared/ipc/bindings";
import { ok, renderWithProviders } from "@/test/render";

import { openCollectionTab } from "../lib/tabs";
import { useCatalogDialogs } from "../store/dialogs";
import { CatalogDialogs } from "./CatalogDialogs";

vi.mock("@/shared/ipc/bindings", () => ({
  commands: {
    createDatabase: vi.fn(),
    createCollection: vi.fn(),
    createView: vi.fn(),
    renameCollection: vi.fn(),
    dropDatabase: vi.fn(),
    dropCollection: vi.fn(),
    listCollections: vi.fn(),
  },
}));

import type { CatalogDialog } from "../store/dialogs";

const open = (dialog: CatalogDialog) => {
  act(() => {
    useCatalogDialogs.getState().open(dialog);
  });
};

beforeEach(() => {
  useCatalogDialogs.setState({ dialog: null });
  useTabsStore.setState({ tabs: [WELCOME_TAB], activeTabId: WELCOME_TAB.id });
  vi.mocked(commands.listCollections).mockReturnValue(ok([]));
});

describe("CatalogDialogs", () => {
  it("creates a database with its first collection", async () => {
    vi.mocked(commands.createDatabase).mockReturnValue(ok(null));
    const user = userEvent.setup();
    renderWithProviders(<CatalogDialogs />);
    open({ type: "createDatabase", connectionId: "c1" });

    const submit = await screen.findByRole("button", { name: "Create database" });
    await user.type(screen.getByLabelText("Database name"), "my.db");
    expect(screen.getByText(/cannot contain/)).toBeInTheDocument();
    expect(submit).toBeDisabled();

    await user.clear(screen.getByLabelText("Database name"));
    await user.type(screen.getByLabelText("Database name"), "shop");
    await user.type(screen.getByLabelText("First collection name"), "orders{Enter}");

    expect(commands.createDatabase).toHaveBeenCalledWith("c1", "shop", "orders");
    await vi.waitFor(() => {
      expect(useCatalogDialogs.getState().dialog).toBeNull();
    });
  });

  it("creates a capped collection", async () => {
    vi.mocked(commands.createCollection).mockReturnValue(ok(null));
    const user = userEvent.setup();
    renderWithProviders(<CatalogDialogs />);
    open({ type: "createCollection", connectionId: "c1", database: "shop" });

    await user.type(await screen.findByLabelText("Collection name"), "log");
    await user.click(screen.getByRole("radio", { name: "Capped" }));
    await user.click(screen.getByRole("button", { name: "Create collection" }));

    expect(commands.createCollection).toHaveBeenCalledWith("c1", "shop", "log", {
      kind: "capped",
      sizeBytes: 16 * 1024 * 1024,
      maxDocuments: null,
    });
  });

  it("shows a backend error inside the dialog and keeps it open", async () => {
    vi.mocked(commands.renameCollection).mockReturnValue(
      Promise.resolve({
        status: "error" as const,
        error: {
          code: "OPERATION_FAILED" as const,
          message: "Target exists.",
          hint: "Pick another name.",
        },
      }),
    );
    const user = userEvent.setup();
    renderWithProviders(<CatalogDialogs />);
    open({ type: "renameCollection", connectionId: "c1", database: "shop", collection: "orders" });

    const input = await screen.findByLabelText("New name");
    await user.clear(input);
    await user.type(input, "archive{Enter}");

    expect(await screen.findByRole("alert")).toHaveTextContent("Target exists.Pick another name.");
    expect(useCatalogDialogs.getState().dialog).not.toBeNull();
  });

  it("renames the open tab after a successful rename", async () => {
    vi.mocked(commands.renameCollection).mockReturnValue(ok(null));
    openCollectionTab("c1", "shop", "orders");
    const user = userEvent.setup();
    renderWithProviders(<CatalogDialogs />);
    open({ type: "renameCollection", connectionId: "c1", database: "shop", collection: "orders" });

    const input = await screen.findByLabelText("New name");
    await user.clear(input);
    await user.type(input, "archive{Enter}");

    await vi.waitFor(() => {
      expect(useTabsStore.getState().activeTabId).toBe("collection:c1:shop.archive");
    });
    expect(useTabsStore.getState().tabs.at(-1)?.title).toBe("archive");
  });

  it("drops a database only after typing its name and closes its tabs", async () => {
    vi.mocked(commands.dropDatabase).mockReturnValue(ok(null));
    openCollectionTab("c1", "shop", "orders");
    const user = userEvent.setup();
    renderWithProviders(<CatalogDialogs />);
    open({ type: "dropDatabase", connectionId: "c1", database: "shop" });

    const confirm = await screen.findByRole("button", { name: "Drop database" });
    expect(confirm).toBeDisabled();
    await user.type(screen.getByLabelText(/to confirm/), "shop{Enter}");

    expect(commands.dropDatabase).toHaveBeenCalledWith("c1", "shop");
    await vi.waitFor(() => {
      expect(useTabsStore.getState().tabs.map((tab) => tab.id)).toEqual(["welcome"]);
    });
  });
});
