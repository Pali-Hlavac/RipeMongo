import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { commands } from "@/shared/ipc/bindings";
import { ok, renderWithProviders } from "@/test/render";

import { newProfile } from "../../lib/defaults";
import { useConnectionDialogs } from "../../store/dialogs";
import type { ActiveConnectionInfo, ConnectionProfile } from "../../types";
import { ConnectionSidebar } from "./ConnectionSidebar";

vi.mock("@/shared/ipc/bindings", () => ({
  commands: { listConnections: vi.fn(), listActiveConnections: vi.fn() },
}));

const profile = (id: string, extra: Partial<ConnectionProfile> = {}): ConnectionProfile => ({
  ...newProfile(),
  id,
  name: id,
  ...extra,
});

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

beforeEach(() => {
  useConnectionDialogs.setState({ editor: { mode: "closed" } });
  vi.mocked(commands.listActiveConnections).mockReturnValue(ok([active]));
});

describe("ConnectionSidebar", () => {
  it("shows an empty state with a call to action", async () => {
    vi.mocked(commands.listConnections).mockReturnValue(ok([]));
    const user = userEvent.setup();
    renderWithProviders(<ConnectionSidebar />);

    const emptyState = (await screen.findByText("No connections yet")).parentElement;
    expect(emptyState).not.toBeNull();
    await user.click(
      within(emptyState ?? document.body).getByRole("button", { name: /new connection/i }),
    );
    expect(useConnectionDialogs.getState().editor).toEqual({ mode: "create" });
  });

  it("groups favorites and folders and shows live status", async () => {
    vi.mocked(commands.listConnections).mockReturnValue(
      ok([profile("prod", { folder: "Production", favorite: true }), profile("local")]),
    );
    renderWithProviders(<ConnectionSidebar />);

    const favorites = await screen.findByRole("list", { name: "Favorites" });
    expect(within(favorites).getByText("prod")).toBeInTheDocument();
    expect(screen.getByRole("list", { name: "Production" })).toBeInTheDocument();
    expect(
      within(screen.getByRole("list", { name: "Other" })).getByText("local"),
    ).toBeInTheDocument();
    expect(await screen.findAllByRole("img", { name: "Connected" })).toHaveLength(2);
    expect(screen.getByRole("img", { name: "Disconnected" })).toBeInTheDocument();
  });

  it("collapses a folder", async () => {
    vi.mocked(commands.listConnections).mockReturnValue(ok([profile("a", { folder: "Dev" })]));
    const user = userEvent.setup();
    renderWithProviders(<ConnectionSidebar />);

    const toggle = await screen.findByRole("button", { name: /dev/i });
    await user.click(toggle);
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("list", { name: "Dev" })).not.toBeInTheDocument();
  });
});
