// Test helper: renders a component inside the app's providers with a fresh query client.
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, type RenderResult } from "@testing-library/react";
import type { ReactElement } from "react";

import { TooltipProvider } from "@/shared/ui/tooltip";

/** Wraps `ui` in QueryClient + Tooltip providers; retries are off so errors surface at once. */
export function renderWithProviders(ui: ReactElement): RenderResult & { queryClient: QueryClient } {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const result = render(
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>{ui}</TooltipProvider>
    </QueryClientProvider>,
  );
  return { ...result, queryClient };
}

/** Result shapes returned by generated tauri-specta commands. */
export const ok = <T,>(data: T) => Promise.resolve({ status: "ok" as const, data });
