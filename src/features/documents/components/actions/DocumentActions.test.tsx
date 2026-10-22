import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { commands } from "@/shared/ipc/bindings";
import type { CodeEditorProps } from "@/shared/editor/types";
import { ok, renderWithProviders } from "@/test/render";

import { useCollectionViewStore } from "../../store/view";
import { CollectionDocuments } from "../CollectionDocuments";

vi.mock("@/shared/ipc/bindings", () => ({
  commands: {
    findDocuments: vi.fn(),
    countDocuments: vi.fn(),
    listQueries: vi.fn(),
    recordQuery: vi.fn(),
    insertDocuments: vi.fn(),
    replaceDocument: vi.fn(),
    setDocumentField: vi.fn(),
    deleteDocument: vi.fn(),
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

const OID = "65a1b2c3d4e5f60718293a00";
const ID_JSON = `{"$oid":"${OID}"}`;
const DOC = `{"_id":${ID_JSON},"name":"Item 0","qty":{"$numberInt":"3"}}`;

const target = {
  tabId: "t1",
  connectionId: "c1",
  database: "shop",
  collection: "items",
  readOnly: false,
};

beforeEach(() => {
  useCollectionViewStore.setState({ states: {} });
  vi.mocked(commands.findDocuments).mockReturnValue(ok({ documents: [DOC], hasMore: false }));
  vi.mocked(commands.countDocuments).mockReturnValue(ok({ count: 1, estimated: false }));
  vi.mocked(commands.listQueries).mockReturnValue(ok({ recent: [], favorites: [] }));
  vi.mocked(commands.recordQuery).mockReturnValue(ok({ recent: [], favorites: [] }));
  vi.mocked(commands.insertDocuments).mockReturnValue(ok(1));
  vi.mocked(commands.replaceDocument).mockReturnValue(ok(null));
  vi.mocked(commands.setDocumentField).mockReturnValue(ok(null));
  vi.mocked(commands.deleteDocument).mockReturnValue(ok(null));
});

async function renderDocuments(readOnly = false) {
  const user = userEvent.setup();
  renderWithProviders(<CollectionDocuments {...target} readOnly={readOnly} />);
  const card = await screen.findByRole("listitem", { name: "Document 1" });
  return { user, card };
}

describe("document actions", () => {
  it("inserts the typed documents", async () => {
    const { user } = await renderDocuments();
    await user.click(screen.getByRole("button", { name: "Insert" }));

    const editor = screen.getByRole("textbox", { name: "Insert documents" });
    await user.clear(editor);
    await user.click(editor);
    await user.paste("[{ a: 1 }, { a: 2 }]");
    await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Insert" }));

    expect(commands.insertDocuments).toHaveBeenCalledWith(
      "c1",
      "shop",
      "items",
      "[{ a: 1 }, { a: 2 }]",
    );
    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });
  });

  it("saves an edited document with its _id and the loaded original", async () => {
    const { user } = await renderDocuments();
    await user.click(screen.getByRole("button", { name: "Edit document 1" }));

    const editor = screen.getByRole("textbox", { name: "Edit document" });
    expect(editor).toHaveValue(`{\n  _id: ObjectId("${OID}"),\n  name: "Item 0",\n  qty: 3\n}`);
    await user.clear(editor);
    await user.paste("{ name: 'Renamed' }");
    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(commands.replaceDocument).toHaveBeenCalledWith(
      "c1",
      "shop",
      "items",
      ID_JSON,
      DOC,
      "{ name: 'Renamed' }",
    );
  });

  it("keeps the editor open and shows a conflict", async () => {
    vi.mocked(commands.replaceDocument).mockResolvedValue({
      status: "error",
      error: { code: "CONFLICT", message: "The document changed since it was loaded.", hint: null },
    });
    const { user } = await renderDocuments();
    await user.click(screen.getByRole("button", { name: "Edit document 1" }));
    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(
      await within(screen.getByRole("dialog")).findByText(/changed since it was loaded/),
    ).toBeInTheDocument();
  });

  it("clones a document without its _id", async () => {
    const { user } = await renderDocuments();
    await user.click(screen.getByRole("button", { name: "Clone document 1" }));

    const editor = screen.getByRole("textbox", { name: "Clone document" });
    expect(editor).toHaveValue('{\n  name: "Item 0",\n  qty: 3\n}');
  });

  it("deletes a document after confirmation", async () => {
    const { user } = await renderDocuments();
    await user.click(screen.getByRole("button", { name: "Delete document 1" }));
    expect(screen.getByText(`The document with _id ${OID} is deleted permanently.`)).toBeVisible();

    await user.click(screen.getByRole("button", { name: "Delete document" }));
    expect(commands.deleteDocument).toHaveBeenCalledWith("c1", "shop", "items", ID_JSON);
  });

  it("edits one field inline", async () => {
    const { user, card } = await renderDocuments();
    const value = within(card).getByText('"Item 0"').closest("button");
    if (!value) throw new Error("the value is not editable");
    await user.dblClick(value);

    const input = screen.getByRole("textbox", { name: "New value of name" });
    await user.clear(input);
    await user.type(input, '"Changed"{Enter}');

    expect(commands.setDocumentField).toHaveBeenCalledWith("c1", "shop", "items", {
      id: ID_JSON,
      path: "name",
      originalValue: '"Item 0"',
      value: '"Changed"',
    });
    await waitFor(() => {
      expect(screen.queryByRole("textbox", { name: "New value of name" })).not.toBeInTheDocument();
    });
  });

  it("offers no writes on a read-only collection", async () => {
    const { card } = await renderDocuments(true);
    expect(screen.queryByRole("button", { name: "Insert" })).not.toBeInTheDocument();
    expect(within(card).queryByRole("button", { name: /Edit|Delete/ })).not.toBeInTheDocument();
    expect(within(card).getByText('"Item 0"').closest("button")).toBeNull();
  });

  it("disables whole-document edits while a projection is applied", async () => {
    useCollectionViewStore.setState({
      states: {
        t1: {
          view: "list",
          pageSize: 20,
          skip: 0,
          query: {
            filter: "",
            projection: "{ name: 1 }",
            sort: "",
            collation: "",
            skip: 0,
            limit: 0,
            maxTimeMs: 0,
          },
        },
      },
    });
    await renderDocuments();
    expect(screen.getByRole("button", { name: "Edit document 1" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Clone document 1" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Delete document 1" })).toBeEnabled();
  });
});
