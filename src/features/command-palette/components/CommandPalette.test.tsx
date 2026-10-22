import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { usePaletteStore } from "../store/palette";
import type { PaletteCommand } from "../types";
import { CommandPalette } from "./CommandPalette";

const makeCommands = (run: () => void): PaletteCommand[] => [
  { id: "theme.dark", group: "Appearance", label: "Use dark theme", run },
  { id: "tabs.close", group: "Tabs", label: "Close tab", run: () => undefined },
];

beforeEach(() => {
  usePaletteStore.setState({ open: false });
});

describe("CommandPalette", () => {
  it("opens with Ctrl+K and lists grouped commands", async () => {
    const user = userEvent.setup();
    render(<CommandPalette commands={makeCommands(vi.fn())} />);

    await user.keyboard("{Control>}k{/Control}");

    expect(await screen.findByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText("Appearance")).toBeInTheDocument();
    expect(screen.getByText("Use dark theme")).toBeInTheDocument();
  });

  it("filters by label and runs the selected command, then closes", async () => {
    const user = userEvent.setup();
    const run = vi.fn();
    usePaletteStore.setState({ open: true });
    render(<CommandPalette commands={makeCommands(run)} />);

    await user.type(screen.getByRole("combobox", { name: "Search commands" }), "dark");
    expect(screen.queryByText("Close tab")).not.toBeInTheDocument();
    await user.keyboard("{Enter}");

    expect(run).toHaveBeenCalledOnce();
    expect(usePaletteStore.getState().open).toBe(false);
  });
});
