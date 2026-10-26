/** Choosing where a copy goes and starting it. */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import type { CopyRequest } from "@/shared/ipc/bindings";
import { commands, unwrap } from "@/shared/ipc/client";

import { addStartedJob } from "./dump";
import { toolsKeys } from "./keys";
import type { EnsureConnected } from "./profiles";

/** Saved connections a copy can go into, by name. */
export function useCopyConnections() {
  return useQuery({
    queryKey: toolsKeys.connections(),
    queryFn: async () => {
      const connections = await unwrap(commands.listConnections());
      return connections
        .map(({ id, name }) => ({ id, name }))
        .sort((a, b) => a.name.localeCompare(b.name));
    },
  });
}

export interface StartCopyInput {
  connectionId: string;
  targetConnectionId: string;
  request: CopyRequest;
}

/** Connects to the target if needed, then starts the copy. */
export function useStartCopy(ensureConnected: EnsureConnected) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ connectionId, targetConnectionId, request }: StartCopyInput) => {
      await ensureConnected(targetConnectionId);
      return unwrap(commands.startCopy(connectionId, targetConnectionId, request));
    },
    onSuccess: (job) => {
      addStartedJob(queryClient, job);
    },
  });
}
