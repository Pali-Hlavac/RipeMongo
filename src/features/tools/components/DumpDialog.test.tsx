import { act, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { open } from "@tauri-apps/plugin-dialog";

import { useJobsPanel } from "@/features/jobs";
import { commands } from "@/shared/ipc/bindings";
import { ok, renderWithProviders } from "@/test/render";

import { useDumpDialog, useSavedDumpsDialog, type DumpTarget } from "../store/dump";
import { dumpProfile, dumpRequest, runningJob } from "../test/fixtures";
import { DumpDialog } from "./DumpDialog";

vi.mock("@/shared/ipc/bindings", () => ({
  commands: {
    startDump: vi.fn(),
    getToolsInfo: vi.fn(),
    listCollections: vi.fn(),
    saveDumpProfile: vi.fn(),
    runDumpProfile: vi.fn(),
  },
}));

vi.mock("@tauri-apps/plugin-dialog", () => ({ open: vi.fn(), save: vi.fn() }));

const tools = (version: string | null) => ({
  tools: [{ tool: "mongodump" as const, version }],
});

const collectionInfo = (name: string) => ({
  name,
  kind: "collection" as const,
  viewOn: null,
  capped: false,
  readOnly: false,
});

function openDialog(target: Partial<DumpTarget> = {}) {
  act(() => {
    useDumpDialog
      .getState()
      .open({ connectionId: "c1", database: "shop", collection: null, ...target });
  });
}

beforeEach(() => {
  vi.mocked(commands.getToolsInfo).mockResolvedValue(tools("100.19.1"));
  vi.mocked(commands.listCollections).mockImplementation(() =>
    ok([collectionInfo("orders"), collectionInfo("logs")]),
  );
  vi.mocked(commands.startDump).mockImplementation(() => ok(runningJob));
  vi.mocked(commands.saveDumpProfile).mockImplementation((input) =>
    ok(dumpProfile({ id: input.id ?? "p2", name: input.name, request: input.request })),
  );
  vi.mocked(commands.runDumpProfile).mockImplementation(() => ok(runningJob));
  useJobsPanel.setState({ open: false });
  useSavedDumpsDialog.setState({ open: false });
});

describe("DumpDialog", () => {
  it("asks for a destination, leaves out unticked collections and shows the jobs panel", async () => {
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
    await user.click(await screen.findByRole("checkbox", { name: "logs" }));
    expect(screen.getByText("1 of 2")).toBeInTheDocument();
    await user.click(screen.getByRole("checkbox", { name: /gzip/i }));
    await user.type(screen.getByRole("spinbutton", { name: "Collections at a time" }), "40");
    await user.click(screen.getByRole("button", { name: "Start dump" }));
    expect(screen.getByText(/whole number from 1 to 16/)).toBeInTheDocument();

    await user.clear(screen.getByRole("spinbutton", { name: "Collections at a time" }));
    await user.type(screen.getByRole("spinbutton", { name: "Collections at a time" }), "2");
    await user.click(screen.getByRole("button", { name: "Start dump" }));

    expect(commands.startDump).toHaveBeenCalledWith(
      "c1",
      dumpRequest({ gzip: true, excludeCollections: ["logs"], parallelCollections: 2 }),
    );
    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });
    await waitFor(() => {
      expect(useJobsPanel.getState().open).toBe(true);
    });
  });

  it("saves a filtered collection dump and starts it", async () => {
    const user = userEvent.setup();
    renderWithProviders(<DumpDialog />);
    openDialog({ collection: "orders" });

    await user.click(screen.getByRole("radio", { name: "Single archive file" }));
    await user.type(screen.getByRole("textbox", { name: "Archive file" }), "C:\\o.archive");
    await user.type(screen.getByRole("textbox", { name: /query filter/i }), "{{ total: 1 }");
    await user.click(screen.getByRole("checkbox", { name: /one-click re-runs/i }));
    expect(screen.getByRole("textbox", { name: "Name" })).toHaveValue("Dump shop.orders");
    await user.click(screen.getByRole("button", { name: "Save and start" }));

    const request = dumpRequest({
      collection: "orders",
      output: { kind: "archive", path: "C:\\o.archive" },
      query: "{ total: 1 }",
    });
    expect(commands.saveDumpProfile).toHaveBeenCalledWith({
      id: null,
      name: "Dump shop.orders",
      connectionId: "c1",
      request,
    });
    await waitFor(() => {
      expect(commands.runDumpProfile).toHaveBeenCalledWith("p2");
    });
    expect(commands.startDump).not.toHaveBeenCalled();
  });

  it("edits a saved dump and returns to the list", async () => {
    const user = userEvent.setup();
    renderWithProviders(<DumpDialog />);
    act(() => {
      useDumpDialog.getState().edit(dumpProfile({ request: dumpRequest({ database: null }) }));
    });

    expect(screen.getByRole("dialog", { name: "Edit “Nightly shop”" })).toBeInTheDocument();
    expect(screen.queryByRole("checkbox", { name: /one-click/i })).not.toBeInTheDocument();
    await user.click(screen.getByRole("checkbox", { name: /oplog/i }));
    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(commands.saveDumpProfile).toHaveBeenCalledWith(
      expect.objectContaining({ id: "p1", request: dumpRequest({ database: null, oplog: true }) }),
    );
    expect(commands.runDumpProfile).not.toHaveBeenCalled();
    await waitFor(() => {
      expect(useSavedDumpsDialog.getState().open).toBe(true);
    });
  });

  it("switches to an archive file and explains when mongodump is missing", async () => {
    vi.mocked(commands.getToolsInfo).mockResolvedValue(tools(null));
    const user = userEvent.setup();
    renderWithProviders(<DumpDialog />);
    openDialog({ database: null });

    await user.click(screen.getByRole("radio", { name: "Single archive file" }));
    expect(screen.getByRole("textbox", { name: "Archive file" })).toBeInTheDocument();
    expect(await screen.findByText(/mongodump is not included/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Start dump" })).toBeDisabled();
  });
});
