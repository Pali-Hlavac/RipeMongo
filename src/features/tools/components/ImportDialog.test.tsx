import { act, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { open } from "@tauri-apps/plugin-dialog";

import { useJobsPanel } from "@/features/jobs";
import { commands, type ImportPreview } from "@/shared/ipc/bindings";
import { ok, renderWithProviders } from "@/test/render";

import { useImportDialog, type ImportTarget } from "../store/transfer";
import { runningJob } from "../test/fixtures";
import { ImportDialog } from "./ImportDialog";

vi.mock("@/shared/ipc/bindings", () => ({
  commands: {
    startImport: vi.fn(),
    getToolsInfo: vi.fn(),
    inspectImportFile: vi.fn(),
  },
}));

vi.mock("@tauri-apps/plugin-dialog", () => ({ open: vi.fn(), save: vi.fn() }));

const csv = (delimiter: string): ImportPreview => ({
  format: "csv",
  size: 2048,
  delimiter,
  columns:
    delimiter === ";"
      ? [
          { first: "zip", samples: ["01234"], suggestion: { type: "string", dateFormat: "" } },
          { first: "secret", samples: ["x"], suggestion: { type: "auto", dateFormat: "" } },
        ]
      : [
          {
            first: "zip;secret",
            samples: ["01234;x"],
            suggestion: { type: "auto", dateFormat: "" },
          },
        ],
});

function openDialog(target: Partial<ImportTarget> = {}) {
  act(() => {
    useImportDialog
      .getState()
      .open({ connectionId: "c1", database: "shop", collection: "people", ...target });
  });
}

beforeEach(() => {
  vi.mocked(commands.getToolsInfo).mockResolvedValue({
    tools: [{ tool: "mongoimport", version: "100.19.1" }],
  });
  vi.mocked(commands.inspectImportFile).mockImplementation((_path, delimiter) =>
    ok(csv(delimiter ?? ",")),
  );
  vi.mocked(commands.startImport).mockImplementation(() => ok({ ...runningJob, kind: "import" }));
  useJobsPanel.setState({ open: false });
});

describe("ImportDialog", () => {
  it("reads a CSV file into a new collection with mapped columns", async () => {
    vi.mocked(open).mockResolvedValue("C:\\data\\people.csv");
    const user = userEvent.setup();
    renderWithProviders(<ImportDialog />);
    openDialog({ collection: null });

    expect(screen.getByRole("dialog", { name: "Import into shop" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /browse/i }));
    expect(await screen.findByText("Text with columns (CSV)")).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "New collection" })).toHaveValue("people");

    // The detected comma finds one column; semicolons split the two.
    await user.selectOptions(
      screen.getByRole("combobox", { name: "Values separated by" }),
      "Semicolon ( ; )",
    );
    expect(commands.inspectImportFile).toHaveBeenLastCalledWith("C:\\data\\people.csv", ";");
    expect(await screen.findByRole("combobox", { name: "Type of column zip" })).toHaveValue(
      "string",
    );
    await user.click(screen.getByRole("checkbox", { name: "Import column secret" }));
    expect(screen.getByText("1 of 2 imported")).toBeInTheDocument();
    await user.clear(screen.getByRole("textbox", { name: "Field name for column zip" }));
    await user.type(
      screen.getByRole("textbox", { name: "Field name for column zip" }),
      "address.zip",
    );
    await user.click(screen.getByRole("button", { name: "Start import" }));

    expect(commands.startImport).toHaveBeenCalledWith(
      "c1",
      expect.objectContaining({
        collection: "people",
        path: "C:\\data\\people.csv",
        format: "csv",
        delimiter: ";",
        columns: [
          { include: true, field: "address.zip", type: "string", dateFormat: "" },
          { include: false, field: "secret", type: "auto", dateFormat: "" },
        ],
      }),
    );
    await vi.waitFor(() => {
      expect(useImportDialog.getState().target).toBeNull();
    });
  });

  it("asks to type the collection name before dropping it", async () => {
    vi.mocked(commands.inspectImportFile).mockImplementation(() =>
      ok({ format: "json", size: 10, delimiter: ",", columns: [] }),
    );
    const user = userEvent.setup();
    renderWithProviders(<ImportDialog />);
    openDialog();

    expect(screen.getByRole("dialog", { name: "Import into shop.people" })).toBeInTheDocument();
    await user.type(screen.getByRole("textbox", { name: "File" }), "C:\\data\\people.json");
    await user.tab();
    expect(await screen.findByText("JSON, one document per line")).toBeInTheDocument();
    expect(screen.queryByRole("textbox", { name: "New collection" })).not.toBeInTheDocument();
    await user.click(screen.getByRole("checkbox", { name: "Drop the collection first" }));
    await user.click(screen.getByRole("button", { name: "Drop and import" }));

    const confirm = await screen.findByRole("dialog", { name: "Drop and import?" });
    expect(commands.startImport).not.toHaveBeenCalled();
    await user.type(within(confirm).getByRole("textbox"), "people");
    await user.click(within(confirm).getByRole("button", { name: "Drop and import" }));
    expect(commands.startImport).toHaveBeenCalledWith(
      "c1",
      expect.objectContaining({ format: "json", drop: true, columns: [] }),
    );
  });
});
