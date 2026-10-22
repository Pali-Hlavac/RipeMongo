import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";

import { KEEP } from "../../lib/secrets";
import type { SecretUpdate } from "../../types";
import { SecretField } from "./SecretField";

function Harness({ stored, onUpdate }: { stored: boolean; onUpdate: (u: SecretUpdate) => void }) {
  const [update, setUpdate] = useState<SecretUpdate>(KEEP);
  return (
    <SecretField
      label="Password"
      stored={stored}
      update={update}
      onChange={(next) => {
        setUpdate(next);
        onUpdate(next);
      }}
    />
  );
}

describe("SecretField", () => {
  it("never shows a stored value and offers to remove it", async () => {
    const user = userEvent.setup();
    const onUpdate = vi.fn();
    render(<Harness stored onUpdate={onUpdate} />);

    const input = screen.getByLabelText("Password");
    expect(input).toHaveValue("");
    expect(input).toHaveAttribute("placeholder", "Saved in keychain — type to replace");

    await user.click(screen.getByRole("button", { name: "Remove" }));
    expect(onUpdate).toHaveBeenLastCalledWith({ action: "clear" });
    expect(input).toHaveAttribute("placeholder", "Will be removed when you save");

    await user.click(screen.getByRole("button", { name: "Undo" }));
    expect(onUpdate).toHaveBeenLastCalledWith(KEEP);
  });

  it("turns typing into a set update and can reveal it", async () => {
    const user = userEvent.setup();
    const onUpdate = vi.fn();
    render(<Harness stored={false} onUpdate={onUpdate} />);

    await user.type(screen.getByLabelText("Password"), "pw");
    expect(onUpdate).toHaveBeenLastCalledWith({ action: "set", value: "pw" });
    expect(screen.queryByRole("button", { name: "Remove" })).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Show Password" }));
    expect(screen.getByLabelText("Password")).toHaveAttribute("type", "text");
  });
});
