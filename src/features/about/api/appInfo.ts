/** Query hook for static app information (name, version, platform). */
import { useQuery } from "@tanstack/react-query";

import { call, commands } from "@/shared/ipc/client";

export const appInfoQueryKey = ["app-info"] as const;

/** App info never changes during a session, so it is fetched once. */
export function useAppInfo() {
  return useQuery({
    queryKey: appInfoQueryKey,
    queryFn: () => call(commands.getAppInfo()),
    staleTime: Infinity,
  });
}
