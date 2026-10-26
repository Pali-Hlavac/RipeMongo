import { act, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { save } from "@tauri-apps/plugin-dialog";

import { useJobsPanel } from "@/features/jobs";
import { commands } from "@/shared/ipc/bindings";
import { ok, renderWithProviders } from "@/test/render";

import { useExportDialog, type ExportTarget } from "../store/transfer";
import { runningJob } from "../test/fixtures";
import { ExportDialog } from "./ExportDialog";

vi.mock("@/shared/ipc/bindings", () => ({
  commands: {
    startExport: vi.fn(),
    getToolsInfo: vi.fn(),
    sampleFields: vi.fn(),
  },
}));

vi.mock("@tauri-apps/plugin-dialog", () => ({ open: vi.fn(), save: vi.fn() }));

function openDialog(target: Partial<ExportTarget> = {}) {
  act(() => {
    useExportDialog
      .getState()
      .open({ connectionId: "c1", database: "shop", collection: "orders", ...target });
  });
}

beforeEach(() => {
  vi.mocked(commands.getToolsInfo).mockResolvedValue({
    tools: [{ tool: "mongoexport", version: "100.19.1" }],
  });
  vi.mocked(commands.sampleFields).mockImplementation(() =>
    ok({ fields: ["_id", "name", "address"], paths: ["_id", "name", "address.city"] }),
  );
  vi.mocked(commands.startExport).mockImplementation(() => ok({ ...runningJob, kind: "export" }));
  useJobsPanel.setState({ open: false });
});

describe("ExportDialog", () => {
  it("exports chosen CSV columns to the picked file and shows the jobs panel", async () => {
    vi.mocked(save).mockResolvedValue("C:\\out\\orders.csv");
    const user = userEvent.setup();
    renderWithProviders(<ExportDialog />);
    openDialog();

    expect(screen.getByRole("dialog", { name: "Export shop.orders" })).toBeInTheDocument();
    await user.click(screen.getByRole("radio", { name: "CSV" }));
    expect(await screen.findByRole("checkbox", { name: "address.city" })).toBeChecked();
    await user.click(screen.getByRole("button", { name: "Start export" }));
    expect(screen.getByText("Choose a file.")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /browse/i }));
    expect(save).toHaveBeenCalledWith({
      defaultPath: "orders.csv",
      filters: [{ name: "CSV", extensions: ["csv"] }],
    });
    await user.click(screen.getByRole("checkbox", { name: "_id" }));
    expect(screen.getByText("2 of 3")).toBeInTheDocument();
    await user.click(screen.getByRole("checkbox", { name: "Field names as the first line" }));
    await user.click(screen.getByRole("button", { name: "Start export" }));

    expect(commands.startExport).toHaveBeenCalledWith(
      "c1",
      expect.objectContaining({
        path: "C:\\out\\orders.csv",
        format: "csv",
        fields: ["name", "address.city"],
        header: false,
      }),
    );
    await vi.waitFor(() => {
      expect(useExportDialog.getState().target).toBeNull();
    });
  });

  it("carries the tab's query and exports whole JSON documents by default", async () => {
    const user = userEvent.setup();
    renderWithProviders(<ExportDialog />);
    openDialog({
      query: {
        filter: "{ total: { $gt: 5 } }",
        sort: "",
        skip: 0,
        limit: 10,
        projection: "{ a: 1 }",
      },
    });

    expect(screen.getByRole("textbox", { name: "Query filter (optional)" })).toHaveValue(
      "{ total: { $gt: 5 } }",
    );
    expect(screen.getByRole("textbox", { name: "Limit" })).toHaveValue("10");
    expect(screen.getByText(/projection is not used/)).toBeInTheDocument();
    await screen.findByRole("checkbox", { name: "address" });
    await user.type(screen.getByRole("textbox", { name: "File" }), "C:\\out\\orders.json");
    await user.click(screen.getByRole("button", { name: "Start export" }));

    expect(commands.startExport).toHaveBeenCalledWith(
      "c1",
      expect.objectContaining({
        format: "json",
        fields: [],
        query: "{ total: { $gt: 5 } }",
        limit: 10,
      }),
    );
  });
});
