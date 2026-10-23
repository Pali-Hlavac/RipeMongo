import { act, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { open } from "@tauri-apps/plugin-dialog";

import { useJobsPanel } from "@/features/jobs";
import { commands } from "@/shared/ipc/bindings";
import { ok, renderWithProviders } from "@/test/render";

import { useDumpDialog } from "../store/dump";
import { DumpDialog } from "./DumpDialog";

vi.mock("@/shared/ipc/bindings", () => ({
  commands: { startDump: vi.fn(), getToolsInfo: vi.fn() },
}));

vi.mock("@tauri-apps/plugin-dialog", () => ({ open: vi.fn(), save: vi.fn() }));

const tools = (version: string | null) => ({
  tools: [{ tool: "mongodump" as const, version }],
});

function openDialog() {
  act(() => {
    useDumpDialog.getState().open({ connectionId: "c1", database: "shop", collection: null });
  });
}

beforeEach(() => {
  vi.mocked(commands.getToolsInfo).mockResolvedValue(tools("100.19.1"));
  vi.mocked(commands.startDump).mockImplementation(() =>
    ok({
      id: "j1",
      kind: "dump",
      title: "Dump shop",
      connectionId: "c1",
      status: "running",
      progress: null,
      command: null,
      summary: null,
      error: null,
      startedAt: 1,
      finishedAt: null,
      logLines: 0,
    }),
  );
  useJobsPanel.setState({ open: false });
});

describe("DumpDialog", () => {
  it("asks for a destination, then starts the dump and shows the jobs panel", async () => {
    vi.mocked(open).mockResolvedValue("C:\\dumps");
    const user = userEvent.setup();
    renderWithProviders(<DumpDialog />);
    openDialog();

    expect(screen.getByRole("dialog", { name: "Dump shop" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Start dump" }));
    expect(screen.getByText("Choose a folder.")).toBeInTheDocument();
    expect(commands.startDump).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: /browse/i }));
    expect(screen.getByRole("textbox", { name: "Folder" })).toHaveValue("C:\\dumps");
    await user.click(screen.getByRole("checkbox", { name: /gzip/i }));
    await user.click(screen.getByRole("button", { name: "Start dump" }));

    expect(commands.startDump).toHaveBeenCalledWith("c1", {
      database: "shop",
      collection: null,
      output: { kind: "folder", path: "C:\\dumps" },
      gzip: true,
    });
    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });
    await waitFor(() => {
      expect(useJobsPanel.getState().open).toBe(true);
    });
  });

  it("switches to an archive file and explains when mongodump is missing", async () => {
    vi.mocked(commands.getToolsInfo).mockResolvedValue(tools(null));
    const user = userEvent.setup();
    renderWithProviders(<DumpDialog />);
    openDialog();

    await user.click(screen.getByRole("radio", { name: "Single archive file" }));
    expect(screen.getByRole("textbox", { name: "Archive file" })).toBeInTheDocument();
    expect(await screen.findByText(/mongodump is not included/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Start dump" })).toBeDisabled();
  });
});
