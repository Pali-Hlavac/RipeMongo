import { act, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { useJobsPanel } from "@/features/jobs";
import { commands } from "@/shared/ipc/bindings";
import { ok, renderWithProviders } from "@/test/render";

import { useDumpDialog, useSavedDumpsDialog } from "../store/dump";
import { dumpProfile, dumpRequest, runningJob } from "../test/fixtures";
import { SavedDumpsDialog } from "./SavedDumpsDialog";

vi.mock("@/shared/ipc/bindings", () => ({
  commands: {
    listDumpProfiles: vi.fn(),
    deleteDumpProfile: vi.fn(),
    runDumpProfile: vi.fn(),
  },
}));

const nightly = dumpProfile({
  lastRunAt: "2026-10-22T21:00:00Z",
  request: dumpRequest({ gzip: true, excludePrefixes: ["tmp_"] }),
});
const weekly = dumpProfile({ id: "p2", name: "Weekly server", connectionId: "c2" });

function openList(ensureConnected = vi.fn().mockResolvedValue(undefined)) {
  renderWithProviders(<SavedDumpsDialog ensureConnected={ensureConnected} />);
  act(() => {
    useSavedDumpsDialog.getState().setOpen(true);
  });
  return ensureConnected;
}

beforeEach(() => {
  vi.mocked(commands.listDumpProfiles).mockImplementation(() => ok([nightly, weekly]));
  vi.mocked(commands.runDumpProfile).mockImplementation(() => ok(runningJob));
  vi.mocked(commands.deleteDumpProfile).mockImplementation(() => ok(null));
  useJobsPanel.setState({ open: false });
  useDumpDialog.getState().close();
});

describe("SavedDumpsDialog", () => {
  it("lists saved dumps with their scope, destination and options", async () => {
    openList();
    const item = await screen.findByRole("listitem", { name: "Nightly shop" });
    expect(within(item).getByText("shop on Local dev")).toBeInTheDocument();
    expect(within(item).getByText("C:\\dumps")).toBeInTheDocument();
    expect(within(item).getByText(/Folder · gzip · 1 exclusion · Last run/)).toBeInTheDocument();
    const other = screen.getByRole("listitem", { name: "Weekly server" });
    expect(within(other).getByText(/Never run/)).toBeInTheDocument();
  });

  it("connects, runs a saved dump and shows the jobs panel", async () => {
    const user = userEvent.setup();
    const ensureConnected = openList();
    const item = await screen.findByRole("listitem", { name: "Weekly server" });
    await user.click(within(item).getByRole("button", { name: "Run" }));

    expect(ensureConnected).toHaveBeenCalledWith("c2");
    await waitFor(() => {
      expect(commands.runDumpProfile).toHaveBeenCalledWith("p2");
    });
    await waitFor(() => {
      expect(useJobsPanel.getState().open).toBe(true);
    });
    expect(useSavedDumpsDialog.getState().open).toBe(false);
  });

  it("shows why it could not connect", async () => {
    const user = userEvent.setup();
    const failing = vi.fn().mockRejectedValue({ code: "CONNECTION_FAILED", message: "No route" });
    openList(failing);
    const item = await screen.findByRole("listitem", { name: "Nightly shop" });
    await user.click(within(item).getByRole("button", { name: "Run" }));

    expect(await screen.findByText("No route")).toBeInTheDocument();
    expect(commands.runDumpProfile).not.toHaveBeenCalled();
  });

  it("opens a saved dump for editing after connecting", async () => {
    const user = userEvent.setup();
    openList();
    await user.click(await screen.findByRole("button", { name: "Edit Nightly shop" }));

    await waitFor(() => {
      expect(useDumpDialog.getState().profile?.id).toBe("p1");
    });
    expect(useSavedDumpsDialog.getState().open).toBe(false);
  });

  it("deletes after confirmation", async () => {
    const user = userEvent.setup();
    openList();
    await user.click(await screen.findByRole("button", { name: "Delete Nightly shop" }));
    await user.click(screen.getByRole("button", { name: "Delete" }));

    expect(commands.deleteDumpProfile).toHaveBeenCalledWith("p1");
    await waitFor(() => {
      expect(screen.queryByRole("listitem", { name: "Nightly shop" })).not.toBeInTheDocument();
    });
  });
});
