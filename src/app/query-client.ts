/** Shared TanStack Query client. Failed mutations surface as toasts with the backend hint. */
import { MutationCache, QueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { toIpcError } from "@/shared/ipc/client";

export function createQueryClient(): QueryClient {
  return new QueryClient({
    mutationCache: new MutationCache({
      onError: (error) => {
        const { message, hint } = toIpcError(error);
        toast.error(message, { description: hint ?? undefined });
      },
    }),
    defaultOptions: {
      // The backend is local; failures are deterministic, so retrying only delays the error.
      queries: { retry: false, refetchOnWindowFocus: false },
      mutations: { retry: false },
    },
  });
}
