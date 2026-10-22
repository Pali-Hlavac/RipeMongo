/** Query hook for the bundled MongoDB Database Tools and their versions. */
import { useQuery } from "@tanstack/react-query";

import { call, commands } from "@/shared/ipc/client";

export const toolsInfoQueryKey = ["tools-info"] as const;

/** The bundled tools do not change while the app runs, so they are checked once. */
export function useToolsInfo() {
  return useQuery({
    queryKey: toolsInfoQueryKey,
    queryFn: () => call(commands.getToolsInfo()),
    staleTime: Infinity,
  });
}
