import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { ConfirmByTypingDialog } from "./ConfirmByTypingDialog";

describe("ConfirmByTypingDialog", () => {
  it("enables the destructive action only after typing the exact text", async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    render(
      <ConfirmByTypingDialog
        open
        onOpenChange={vi.fn()}
        title="Drop database?"
        description="All data is deleted."
        confirmText="shop"
        confirmLabel="Drop database"
        onConfirm={onConfirm}
      />,
    );
    const confirm = screen.getByRole("button", { name: "Drop database" });
    const input = screen.getByLabelText(/to confirm/);

    expect(confirm).toBeDisabled();
    await user.type(input, "Shop");
    expect(confirm).toBeDisabled();
    await user.clear(input);
    await user.type(input, "shop{Enter}");

    expect(confirm).toBeEnabled();
    expect(onConfirm).toHaveBeenCalledOnce();
  });
});
