import { act, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";

import { catalogKeys } from "@/features/catalog";
import { useTabsStore, WELCOME_TAB } from "@/features/workspace";
import { commands } from "@/shared/ipc/bindings";
import { ok } from "@/test/render";

import { useDeleteConnection } from "./profiles";

vi.mock("@/shared/ipc/bindings", () => ({
  commands: { deleteConnection: vi.fn() },
}));

describe("useDeleteConnection", () => {
  it("closes every tab of the connection and drops its cached catalog", async () => {
    vi.mocked(commands.deleteConnection).mockReturnValue(ok(null));
    useTabsStore.setState({
      tabs: [
        WELCOME_TAB,
        { id: "connection:c1", kind: "connection", connectionId: "c1", title: "Prod" },
        {
          id: "collection:c1:shop.orders",
          kind: "collection",
          connectionId: "c1",
          database: "shop",
          collection: "orders",
          title: "orders",
        },
        { id: "connection:c2", kind: "connection", connectionId: "c2", title: "Other" },
      ],
      activeTabId: "collection:c1:shop.orders",
    });
    const queryClient = new QueryClient();
    queryClient.setQueryData(catalogKeys.databases("c1"), []);
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
    const { result } = renderHook(() => useDeleteConnection(), { wrapper });

    act(() => {
      result.current.mutate("c1");
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });
    expect(useTabsStore.getState().tabs.map((tab) => tab.id)).toEqual(["welcome", "connection:c2"]);
    expect(queryClient.getQueryData(catalogKeys.databases("c1"))).toBeUndefined();
  });
});
