import { act, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { open } from "@tauri-apps/plugin-dialog";

import { useJobsPanel } from "@/features/jobs";
import { commands, type DumpContents } from "@/shared/ipc/bindings";
import { ok, renderWithProviders } from "@/test/render";

import { useRestoreDialog } from "../store/dump";
import { runningJob } from "../test/fixtures";
import { RestoreDialog } from "./RestoreDialog";

vi.mock("@/shared/ipc/bindings", () => ({
  commands: { inspectDump: vi.fn(), startRestore: vi.fn(), getToolsInfo: vi.fn() },
}));

vi.mock("@tauri-apps/plugin-dialog", () => ({ open: vi.fn(), save: vi.fn() }));

const contents: DumpContents = {
  gzip: true,
  oplog: true,
  namespaces: [
    { database: "shop", collection: "items", view: false, size: 0 },
    { database: "shop", collection: "users", view: false, size: 0 },
  ],
};

function openDialog() {
  renderWithProviders(<RestoreDialog />);
  act(() => {
    useRestoreDialog.getState().open({ connectionId: "c1", connectionName: "Local dev" });
  });
}

beforeEach(() => {
  vi.mocked(commands.getToolsInfo).mockResolvedValue({
    tools: [{ tool: "mongorestore", version: "100.19.1" }],
  });
  vi.mocked(commands.inspectDump).mockImplementation(() => ok(contents));
  vi.mocked(commands.startRestore).mockImplementation(() => ok(runningJob));
  vi.mocked(open).mockResolvedValue("C:\\dumps\\nightly");
  useJobsPanel.setState({ open: false });
});

describe("RestoreDialog", () => {
  it("reads the dump, restores a renamed copy without one collection, and shows the jobs", async () => {
    const user = userEvent.setup();
    openDialog();
    expect(screen.getByRole("dialog", { name: "Restore into Local dev" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Restore" })).toBeDisabled();

    await user.click(screen.getByRole("button", { name: /browse/i }));
    expect(commands.inspectDump).toHaveBeenCalledWith({
      kind: "folder",
      path: "C:\\dumps\\nightly",
    });
    await user.click(await screen.findByRole("checkbox", { name: "users" }));
    expect(screen.getByText("1 of 2")).toBeInTheDocument();
    const shop = screen.getByRole("checkbox", { name: "shop" });
    expect((shop as HTMLInputElement).indeterminate).toBe(true);
    const oplog = screen.getByRole("checkbox", { name: /replay the oplog/i });
    expect(oplog).toBeDisabled();
    await user.type(screen.getByRole("textbox", { name: "Restore shop as" }), "shop_copy");
    await user.click(screen.getByRole("button", { name: "Restore" }));

    expect(commands.startRestore).toHaveBeenCalledWith("c1", {
      source: { kind: "folder", path: "C:\\dumps\\nightly" },
      exclude: ["shop.users"],
      renames: [{ from: "shop", to: "shop_copy" }],
      drop: false,
      dryRun: false,
      oplogReplay: false,
      parallelCollections: null,
    });
    await waitFor(() => {
      expect(useJobsPanel.getState().open).toBe(true);
    });
  });

  it("asks to type the connection name before dropping", async () => {
    const user = userEvent.setup();
    openDialog();
    await user.click(screen.getByRole("button", { name: /browse/i }));
    expect(await screen.findByRole("checkbox", { name: /replay the oplog/i })).toBeChecked();
    await user.click(screen.getByRole("checkbox", { name: /drop each collection/i }));
    await user.click(screen.getByRole("button", { name: "Restore" }));

    const confirm = screen.getByRole("button", { name: "Drop and restore" });
    expect(confirm).toBeDisabled();
    await user.type(screen.getByRole("textbox", { name: /type/i }), "Local dev");
    await user.click(confirm);
    expect(commands.startRestore).toHaveBeenCalledWith(
      "c1",
      expect.objectContaining({ drop: true, oplogReplay: true, exclude: [] }),
    );
  });

  it("explains a path that is not a dump", async () => {
    vi.mocked(commands.inspectDump).mockImplementation(() =>
      Promise.resolve({
        status: "error" as const,
        error: {
          code: "INVALID_INPUT",
          message: "This file is not an archive made by mongodump.",
          hint: null,
        },
      }),
    );
    const user = userEvent.setup();
    openDialog();
    await user.click(screen.getByRole("radio", { name: "Single archive file" }));
    await user.type(screen.getByRole("textbox", { name: "Archive file" }), "C:\\notes.txt");
    await user.tab();

    expect(await screen.findByText(/not an archive made by mongodump/)).toBeInTheDocument();
    expect(commands.inspectDump).toHaveBeenCalledWith({ kind: "archive", path: "C:\\notes.txt" });
    expect(screen.getByRole("button", { name: "Restore" })).toBeDisabled();
  });
});
