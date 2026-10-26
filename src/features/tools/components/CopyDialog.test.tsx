import { act, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { useJobsPanel } from "@/features/jobs";
import { commands } from "@/shared/ipc/bindings";
import { ok, renderWithProviders } from "@/test/render";

import { useCopyDialog, type CopyTarget } from "../store/transfer";
import { connectionProfile, runningJob } from "../test/fixtures";
import { CopyDialog } from "./CopyDialog";

vi.mock("@/shared/ipc/bindings", () => ({
  commands: {
    startCopy: vi.fn(),
    getToolsInfo: vi.fn(),
    listCollections: vi.fn(),
    listConnections: vi.fn(),
  },
}));

const collectionInfo = (name: string) => ({
  name,
  kind: "collection" as const,
  viewOn: null,
  capped: false,
  readOnly: false,
});

const ensureConnected = vi.fn<(connectionId: string) => Promise<void>>();

function openDialog(target: Partial<CopyTarget> = {}) {
  act(() => {
    useCopyDialog
      .getState()
      .open({ connectionId: "c1", database: "shop", collection: "orders", ...target });
  });
}

beforeEach(() => {
  vi.mocked(commands.getToolsInfo).mockResolvedValue({
    tools: [
      { tool: "mongodump", version: "100.19.1" },
      { tool: "mongorestore", version: "100.19.1" },
    ],
  });
  vi.mocked(commands.listConnections).mockImplementation(() =>
    ok([connectionProfile("c1", "Local"), connectionProfile("c2", "Staging")]),
  );
  vi.mocked(commands.listCollections).mockImplementation(() =>
    ok([collectionInfo("orders"), collectionInfo("logs")]),
  );
  vi.mocked(commands.startCopy).mockImplementation(() => ok({ ...runningJob, kind: "copy" }));
  ensureConnected.mockResolvedValue();
  useJobsPanel.setState({ open: false });
});

describe("CopyDialog", () => {
  it("copies a collection with a query into another connection, connecting it first", async () => {
    const user = userEvent.setup();
    renderWithProviders(<CopyDialog ensureConnected={ensureConnected} />);
    openDialog();

    expect(screen.getByRole("dialog", { name: "Copy shop.orders" })).toBeInTheDocument();
    const connection = screen.getByRole("combobox", { name: "Copy to connection" });
    await waitFor(() => {
      expect(connection).toBeEnabled();
    });
    expect(screen.getByRole("textbox", { name: "Collection" })).toHaveValue("orders_copy");
    await user.selectOptions(connection, "c2");
    expect(screen.getByRole("textbox", { name: "Collection" })).toHaveValue("orders");
    await user.type(
      screen.getByRole("textbox", { name: "Only documents matching" }),
      "{{ total: 1 }",
    );
    await user.click(screen.getByRole("checkbox", { name: "Copy indexes" }));
    await user.click(screen.getByRole("button", { name: "Start copy" }));

    await waitFor(() => {
      expect(commands.startCopy).toHaveBeenCalledWith("c1", "c2", {
        database: "shop",
        collection: "orders",
        targetDatabase: "shop",
        targetCollection: "orders",
        query: "{ total: 1 }",
        excludeCollections: [],
        excludePrefixes: [],
        indexes: false,
        drop: false,
      });
    });
    expect(ensureConnected).toHaveBeenCalledWith("c2");
    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });
    await waitFor(() => {
      expect(useJobsPanel.getState().open).toBe(true);
    });
  });

  it("refuses the source as the target and confirms replacing by typing the name", async () => {
    const user = userEvent.setup();
    renderWithProviders(<CopyDialog ensureConnected={ensureConnected} />);
    openDialog({ collection: null });

    const name = screen.getByRole("textbox", { name: "Database name there" });
    await user.clear(name);
    await user.type(name, "shop");
    await user.click(screen.getByRole("button", { name: "Start copy" }));
    expect(screen.getByText(/This is the database you copy from/)).toBeInTheDocument();

    await user.clear(name);
    await user.type(name, "archive");
    await user.click(await screen.findByRole("checkbox", { name: "logs" }));
    await user.click(screen.getByRole("checkbox", { name: "Replace collections that exist" }));
    await user.click(screen.getByRole("button", { name: "Replace and copy" }));
    const confirm = await screen.findByRole("dialog", { name: "Replace and copy?" });
    expect(confirm).toHaveTextContent("Each collection copied into archive on Local is deleted");
    expect(commands.startCopy).not.toHaveBeenCalled();
    await user.type(within(confirm).getByRole("textbox"), "archive");
    await user.click(within(confirm).getByRole("button", { name: "Replace and copy" }));

    await waitFor(() => {
      expect(commands.startCopy).toHaveBeenCalledWith(
        "c1",
        "c1",
        expect.objectContaining({
          collection: null,
          targetDatabase: "archive",
          excludeCollections: ["logs"],
          drop: true,
        }),
      );
    });
  });
});
