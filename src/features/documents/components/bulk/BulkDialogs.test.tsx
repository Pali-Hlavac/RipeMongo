import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import type { CodeEditorProps } from "@/shared/editor/types";
import { commands } from "@/shared/ipc/bindings";
import { ok, renderWithProviders } from "@/test/render";

import { BulkActionsMenu } from "./BulkActionsMenu";

vi.mock("@/shared/ipc/bindings", () => ({
  commands: {
    previewUpdateMany: vi.fn(),
    updateMany: vi.fn(),
    previewDeleteMany: vi.fn(),
    deleteMany: vi.fn(),
  },
}));

// Monaco needs a real browser; a textarea stands in for it.
vi.mock("@/shared/editor/LazyCodeEditor", () => ({
  LazyCodeEditor: ({ value, onChange, ariaLabel }: CodeEditorProps) => (
    <textarea
      aria-label={ariaLabel}
      defaultValue={value}
      onChange={(event) => {
        onChange(event.target.value);
      }}
    />
  ),
}));

const target = { connectionId: "c1", database: "shop", collection: "items" };
const doc = (n: number, status: string) => `{"_id":{"$numberInt":"${n}"},"status":"${status}"}`;
const matched = { count: 2, estimated: false };

beforeEach(() => {
  vi.mocked(commands.previewUpdateMany).mockReturnValue(
    ok({
      matched,
      simulated: true,
      samples: [1, 2].map((n) => ({ before: doc(n, "new"), after: doc(n, "done") })),
    }),
  );
  vi.mocked(commands.updateMany).mockReturnValue(ok({ matched: 2, modified: 2 }));
  vi.mocked(commands.previewDeleteMany).mockReturnValue(
    ok({ matched, samples: [doc(1, "new"), doc(2, "new")] }),
  );
  vi.mocked(commands.deleteMany).mockReturnValue(ok(2));
});

async function open(item: RegExp) {
  const user = userEvent.setup();
  renderWithProviders(<BulkActionsMenu target={target} filter="{ status: 'new' }" />);
  await user.click(screen.getByRole("button", { name: /bulk/i }));
  await user.click(screen.getByRole("menuitem", { name: item }));
  return { user, dialog: screen.getByRole("dialog") };
}

async function confirmByTyping(user: ReturnType<typeof userEvent.setup>, label: string) {
  const confirm = await screen.findByRole("dialog", { name: /\?$/ });
  const button = within(confirm).getByRole("button", { name: label });
  expect(button).toBeDisabled();
  await user.type(within(confirm).getByRole("textbox"), "items");
  await user.click(button);
}

describe("bulk actions", () => {
  it("previews matching documents, then deletes after typing the collection name", async () => {
    const { user, dialog } = await open(/delete documents/i);

    expect(await within(dialog).findByText("2 documents match the filter.")).toBeInTheDocument();
    expect(commands.previewDeleteMany).toHaveBeenCalledWith(
      "c1",
      "shop",
      "items",
      "{ status: 'new' }",
    );
    await user.click(within(dialog).getByRole("button", { name: "Delete 2 documents" }));
    await confirmByTyping(user, "Delete documents");

    expect(commands.deleteMany).toHaveBeenCalledWith("c1", "shop", "items", "{ status: 'new' }");
    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });
  });

  it("offers no delete when nothing matches", async () => {
    vi.mocked(commands.previewDeleteMany).mockReturnValue(
      ok({ matched: { count: 0, estimated: false }, samples: [] }),
    );
    const { dialog } = await open(/delete documents/i);

    expect(await within(dialog).findByText("No documents match the filter.")).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "Delete documents" })).toBeDisabled();
  });

  it("shows before and after, and requires a fresh preview before updating", async () => {
    const { user, dialog } = await open(/update documents/i);
    const apply = within(dialog).getByRole("button", { name: "Update documents" });
    expect(apply).toBeDisabled();

    const editor = within(dialog).getByRole("textbox", { name: "Update" });
    await user.clear(editor);
    await user.click(editor);
    await user.paste("{ $set: { status: 'done' } }");
    await user.click(within(dialog).getByRole("button", { name: "Preview" }));

    const first = await within(dialog).findByRole("listitem", { name: "Sample 1" });
    expect(within(first).getByText("Before")).toBeInTheDocument();
    expect(first).toHaveTextContent('status: "done"');
    expect(commands.previewUpdateMany).toHaveBeenCalledWith(
      "c1",
      "shop",
      "items",
      "{ status: 'new' }",
      "{ $set: { status: 'done' } }",
    );

    await user.type(editor, " ");
    expect(within(dialog).getByText(/changed since this preview/)).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "Update documents" })).toBeDisabled();
    await user.click(within(dialog).getByRole("button", { name: "Preview" }));
    await user.click(await within(dialog).findByRole("button", { name: "Update 2 documents" }));
    await confirmByTyping(user, "Update documents");

    expect(commands.updateMany).toHaveBeenCalledWith(
      "c1",
      "shop",
      "items",
      "{ status: 'new' }",
      "{ $set: { status: 'done' } } ",
    );
  });

  it("explains that a standalone server cannot preview the result", async () => {
    vi.mocked(commands.previewUpdateMany).mockReturnValue(
      ok({ matched, simulated: false, samples: [{ before: doc(1, "new"), after: null }] }),
    );
    const { user, dialog } = await open(/update documents/i);
    await user.click(within(dialog).getByRole("button", { name: "Preview" }));

    expect(await within(dialog).findByText(/cannot be previewed/)).toBeInTheDocument();
    expect(within(dialog).queryByText("After")).not.toBeInTheDocument();
  });
});
