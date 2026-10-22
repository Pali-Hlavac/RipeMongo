import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { commands } from "@/shared/ipc/bindings";
import { ok, renderWithProviders } from "@/test/render";

import { useCollectionViewStore } from "../store/view";
import { CollectionDocuments } from "./CollectionDocuments";

vi.mock("@/shared/ipc/bindings", () => ({
  commands: {
    findDocuments: vi.fn(),
    countDocuments: vi.fn(),
    listQueries: vi.fn(),
    recordQuery: vi.fn(),
  },
}));

const doc = (n: number) =>
  JSON.stringify({
    _id: { $oid: `65a1b2c3d4e5f60718293a${n.toString(16).padStart(2, "0")}` },
    name: `Item ${n}`,
    qty: { $numberInt: String(n) },
    address: { city: "Bratislava", zip: "81101" },
  });

const target = {
  tabId: "t1",
  connectionId: "c1",
  database: "shop",
  collection: "items",
  readOnly: false,
};

beforeEach(() => {
  useCollectionViewStore.setState({ states: {} });
  vi.mocked(commands.findDocuments).mockImplementation((_c, _d, _coll, request) =>
    ok({
      documents: Array.from({ length: Math.min(request.limit, 3) }, (_, i) =>
        doc(request.skip + i),
      ),
      hasMore: request.skip === 0,
    }),
  );
  vi.mocked(commands.countDocuments).mockReturnValue(ok({ count: 1500, estimated: true }));
  vi.mocked(commands.listQueries).mockReturnValue(ok({ recent: [], favorites: [] }));
  vi.mocked(commands.recordQuery).mockReturnValue(ok({ recent: [], favorites: [] }));
});

describe("CollectionDocuments", () => {
  it("lists documents with expandable nested fields", async () => {
    const user = userEvent.setup();
    renderWithProviders(<CollectionDocuments {...target} />);

    const first = await screen.findByRole("listitem", { name: "Document 1" });
    expect(within(first).getByText('"Item 0"')).toBeInTheDocument();
    expect(within(first).getByText('ObjectId("65a1b2c3d4e5f60718293a00")')).toBeInTheDocument();
    expect(within(first).queryByText('"Bratislava"')).not.toBeInTheDocument();

    await user.click(within(first).getByRole("button", { name: /address/ }));
    expect(within(first).getByText('"Bratislava"')).toBeInTheDocument();
    expect(screen.getByText("1–3 of about 1,500")).toBeInTheDocument();
  });

  it("pages forward with the chosen page size", async () => {
    const user = userEvent.setup();
    renderWithProviders(<CollectionDocuments {...target} />);
    await screen.findByRole("listitem", { name: "Document 1" });

    await user.selectOptions(screen.getByLabelText("Documents per page"), "50");
    await user.click(screen.getByRole("button", { name: "Next page" }));

    expect(await screen.findByText("51–53 of about 1,500")).toBeInTheDocument();
    expect(commands.findDocuments).toHaveBeenLastCalledWith(
      "c1",
      "shop",
      "items",
      expect.objectContaining({ skip: 50, limit: 50 }),
    );
    expect(screen.getByRole("button", { name: "Next page" })).toBeDisabled();
  });

  it("switches to the JSON and table views", async () => {
    const user = userEvent.setup();
    renderWithProviders(<CollectionDocuments {...target} />);
    await screen.findByRole("listitem", { name: "Document 1" });

    await user.click(screen.getByRole("radio", { name: "JSON" }));
    const json = screen.getByRole("listitem", { name: "Document 1" });
    expect(json).toHaveTextContent("qty: 0,");
    expect(json).toHaveTextContent('city: "Bratislava"');

    // jsdom has no layout; give the scroll container a size so the virtualizer renders rows.
    vi.spyOn(HTMLElement.prototype, "clientHeight", "get").mockReturnValue(600);
    vi.spyOn(HTMLElement.prototype, "clientWidth", "get").mockReturnValue(1000);
    await user.click(screen.getByRole("radio", { name: "Table" }));
    const table = screen.getByRole("table", { name: "Documents" });
    expect(
      within(table)
        .getAllByRole("columnheader")
        .map((h) => h.textContent),
    ).toEqual(["#", "_id", "name", "qty", "address"]);
    expect(within(table).getByText("Item 2")).toBeInTheDocument();
    expect(within(table).getAllByText("{ 2 fields }")).toHaveLength(3);
  });
});
