/** TanStack Query hooks for user settings persisted by the backend. */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import type { Settings } from "@/shared/ipc/bindings";
import { commands, unwrap } from "@/shared/ipc/client";

export const settingsQueryKey = ["settings"] as const;

/** Loads settings once; they only change through {@link useUpdateSettings}. */
export function useSettings() {
  return useQuery({
    queryKey: settingsQueryKey,
    queryFn: () => unwrap(commands.getSettings()),
    staleTime: Infinity,
  });
}

/** Saves settings optimistically and rolls back if the backend rejects them. */
export function useUpdateSettings() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (settings: Settings) => unwrap(commands.updateSettings(settings)),
    onMutate: async (next) => {
      await queryClient.cancelQueries({ queryKey: settingsQueryKey });
      const previous = queryClient.getQueryData<Settings>(settingsQueryKey);
      queryClient.setQueryData(settingsQueryKey, next);
      return { previous };
    },
    onError: (_error, _next, context) => {
      queryClient.setQueryData(settingsQueryKey, context?.previous);
    },
    onSuccess: (saved) => {
      queryClient.setQueryData(settingsQueryKey, saved);
    },
  });
}
