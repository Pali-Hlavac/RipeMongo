import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { commands } from "@/shared/ipc/bindings";
import { ok, renderWithProviders } from "@/test/render";

import { useCollectionViewStore } from "../../store/view";
import type { SavedQuery } from "../../types";
import { CollectionDocuments } from "../CollectionDocuments";

vi.mock("@/shared/ipc/bindings", () => ({
  commands: {
    findDocuments: vi.fn(),
    countDocuments: vi.fn(),
    listQueries: vi.fn(),
    recordQuery: vi.fn(),
  },
}));

const target = {
  tabId: "t1",
  connectionId: "c1",
  database: "shop",
  collection: "items",
  readOnly: false,
};
const DOC = JSON.stringify({ _id: { $oid: "65a1b2c3d4e5f60718293a00" }, name: "Ann", age: 30 });
const recent: SavedQuery = {
  id: "r1",
  name: null,
  query: { filter: "{ age: { $gt: 18 } }", projection: "", sort: "{ name: 1 }", collation: "" },
  savedAt: "2026-10-22T10:00:00Z",
};

beforeEach(() => {
  useCollectionViewStore.setState({ states: {} });
  vi.mocked(commands.findDocuments).mockReturnValue(ok({ documents: [DOC], hasMore: false }));
  vi.mocked(commands.countDocuments).mockReturnValue(ok({ count: 1, estimated: false }));
  vi.mocked(commands.listQueries).mockReturnValue(ok({ recent: [recent], favorites: [] }));
  vi.mocked(commands.recordQuery).mockReturnValue(ok({ recent: [recent], favorites: [] }));
});

const lastRequest = () => vi.mocked(commands.findDocuments).mock.lastCall?.[3];

describe("QueryBar", () => {
  it("runs a filter on Enter and records it once it loaded", async () => {
    const user = userEvent.setup();
    renderWithProviders(<CollectionDocuments {...target} />);
    await screen.findByRole("listitem", { name: "Document 1" });

    await user.type(screen.getByRole("combobox", { name: "Filter" }), "{{ age: 30 }{Enter}");

    await waitFor(() => {
      expect(lastRequest()).toMatchObject({ filter: "{ age: 30 }", skip: 0 });
    });
    await waitFor(() => {
      expect(commands.recordQuery).toHaveBeenCalledWith("c1", "shop", "items", {
        filter: "{ age: 30 }",
        projection: "",
        sort: "",
        collation: "",
      });
    });
    expect(commands.countDocuments).toHaveBeenLastCalledWith(
      "c1",
      "shop",
      "items",
      "{ age: 30 }",
      10_000,
    );
  });

  it("suggests field names from loaded documents", async () => {
    const user = userEvent.setup();
    renderWithProviders(<CollectionDocuments {...target} />);
    await screen.findByRole("listitem", { name: "Document 1" });

    const filter = screen.getByRole("combobox", { name: "Filter" });
    await user.type(filter, "{{ na");
    const options = within(screen.getByRole("listbox", { name: "Suggestions" })).getAllByRole(
      "option",
    );
    expect(options.map((option) => option.textContent)).toEqual(["namefield"]);
    await user.keyboard("{Enter}");
    expect(filter).toHaveValue("{ name");
    expect(screen.getByRole("listbox", { hidden: true })).not.toBeVisible();
  });

  it("explains a rejected query next to the input", async () => {
    vi.mocked(commands.findDocuments).mockImplementation((_c, _d, _coll, request) =>
      request.sort
        ? Promise.resolve({
            status: "error" as const,
            error: {
              code: "INVALID_INPUT" as const,
              message: "Sort: Unexpected end (line 1, column 4)",
              hint: null,
            },
          })
        : ok({ documents: [DOC], hasMore: false }),
    );
    const user = userEvent.setup();
    renderWithProviders(<CollectionDocuments {...target} />);
    await screen.findByRole("listitem", { name: "Document 1" });

    await user.click(screen.getByRole("button", { name: "Options" }));
    await user.type(screen.getByRole("combobox", { name: "Sort" }), "{{ a{Escape}{Enter}");

    expect(await screen.findByRole("alert")).toHaveTextContent("Sort: Unexpected end");
    expect(screen.getByRole("combobox", { name: "Sort" })).toHaveAttribute("aria-invalid", "true");
    expect(commands.recordQuery).not.toHaveBeenCalledWith(
      "c1",
      "shop",
      "items",
      expect.objectContaining({ sort: "{ a" }),
    );
  });

  it("runs a recent query from the history menu", async () => {
    const user = userEvent.setup();
    renderWithProviders(<CollectionDocuments {...target} />);
    await screen.findByRole("listitem", { name: "Document 1" });

    await user.click(screen.getByRole("button", { name: "History" }));
    await user.click(await screen.findByRole("menuitem", { name: /age: \{ \$gt: 18 \}/ }));

    await waitFor(() => {
      expect(lastRequest()).toMatchObject({ filter: "{ age: { $gt: 18 } }", sort: "{ name: 1 }" });
    });
    expect(screen.getByRole("combobox", { name: "Filter" })).toHaveValue("{ age: { $gt: 18 } }");
  });
});
