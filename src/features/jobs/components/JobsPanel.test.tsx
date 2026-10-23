import { act, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { toast } from "sonner";

import { commands, events, type JobInfo, type JobUpdated } from "@/shared/ipc/bindings";
import { ok, renderWithProviders } from "@/test/render";

import { jobKeys } from "../api/jobs";
import { useJobEvents } from "../hooks/useJobEvents";
import { useJobsPanel } from "../store/panel";
import { JobsButton } from "./JobsButton";
import { JobsPanel } from "./JobsPanel";

type Listener = (event: { payload: JobUpdated }) => void;
const listeners: Listener[] = [];

vi.mock("@/shared/ipc/bindings", () => ({
  commands: {
    listJobs: vi.fn(),
    getJobLog: vi.fn(),
    cancelJob: vi.fn(),
    dismissJob: vi.fn(),
  },
  events: {
    jobUpdated: { listen: vi.fn() },
    jobLogged: { listen: vi.fn() },
  },
}));

vi.mock("sonner", () => ({ toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }) }));

function job(patch: Partial<JobInfo>): JobInfo {
  return {
    id: "j1",
    kind: "dump",
    title: "Dump shop",
    connectionId: "c1",
    status: "running",
    progress: { done: 300, total: 1200, unit: "documents", message: "shop.items" },
    command: "mongodump --uri=mongodb://localhost:27017/ --db=shop --out=C:\\dumps",
    summary: null,
    error: null,
    startedAt: 1_000,
    finishedAt: null,
    logLines: 2,
    ...patch,
  };
}

const onFinished = vi.fn();

function App() {
  useJobEvents(onFinished);
  return (
    <>
      <JobsButton />
      <JobsPanel />
    </>
  );
}

beforeEach(() => {
  listeners.length = 0;
  vi.mocked(events.jobUpdated.listen).mockImplementation((listener) => {
    listeners.push(listener as Listener);
    return Promise.resolve(() => undefined);
  });
  vi.mocked(events.jobLogged.listen).mockResolvedValue(() => undefined);
  vi.mocked(commands.getJobLog).mockReturnValue(ok(["writing shop.items", "done dumping"]));
  vi.mocked(commands.cancelJob).mockReturnValue(ok(null));
  vi.mocked(commands.dismissJob).mockReturnValue(ok(null));
  useJobsPanel.setState({ open: false });
});

describe("jobs panel", () => {
  it("shows progress, cancels, and opens the log with the equivalent command", async () => {
    vi.mocked(commands.listJobs).mockResolvedValue([job({})]);
    const user = userEvent.setup();
    renderWithProviders(<App />);

    await user.click(await screen.findByRole("button", { name: /1 running/ }));
    const panel = screen.getByRole("dialog", { name: "Background jobs" });
    expect(within(panel).getByRole("progressbar")).toHaveAttribute("aria-valuenow", "25");
    expect(within(panel).getByText("300 of 1,200 documents (25%)")).toBeInTheDocument();

    await user.click(within(panel).getByRole("button", { name: /cancel/i }));
    expect(commands.cancelJob).toHaveBeenCalledWith("j1");

    await user.click(within(panel).getByRole("button", { name: /details and log/i }));
    const log = await screen.findByRole("dialog", { name: "Dump shop" });
    expect(within(log).getByText(/--db=shop/)).toBeInTheDocument();
    expect(await within(log).findByText(/done dumping/)).toBeInTheDocument();
  });

  it("follows job events and notifies when a job finishes", async () => {
    vi.mocked(commands.listJobs).mockResolvedValue([]);
    const user = userEvent.setup();
    const { queryClient } = renderWithProviders(<App />);
    await waitFor(() => {
      expect(listeners).toHaveLength(1);
      expect(queryClient.getQueryData(jobKeys.list())).toEqual([]);
    });

    act(() => {
      listeners[0]?.({ payload: { job: job({}) } });
    });
    expect(await screen.findByRole("button", { name: /1 running/ })).toBeInTheDocument();

    const done = job({ status: "succeeded", summary: "Dumped 2 collections", finishedAt: 2_000 });
    act(() => {
      listeners[0]?.({ payload: { job: done } });
    });
    expect(toast.success).toHaveBeenCalledWith(
      "Dump shop: done",
      expect.objectContaining({ description: "Dumped 2 collections" }),
    );
    expect(onFinished).toHaveBeenCalledWith(done);

    await user.click(await screen.findByRole("button", { name: "Background jobs" }));
    const panel = screen.getByRole("dialog", { name: "Background jobs" });
    expect(within(panel).getByText("Dumped 2 collections")).toBeInTheDocument();
    await user.click(within(panel).getByRole("button", { name: /remove dump shop/i }));
    expect(commands.dismissJob).toHaveBeenCalledWith("j1");
    expect(await within(panel).findByText("No jobs yet")).toBeInTheDocument();
  });
});
