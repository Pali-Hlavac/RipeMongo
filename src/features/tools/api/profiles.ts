/** Saved dumps: list, delete and run. Saving goes through `useSubmitDump`. */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import type { DumpProfile } from "@/shared/ipc/bindings";
import { commands, unwrap } from "@/shared/ipc/client";

import { addStartedJob } from "./dump";
import { toolsKeys } from "./keys";

/** Opens a connection unless it is open; provided by the app (it belongs to connections). */
export type EnsureConnected = (connectionId: string) => Promise<void>;

export function useDumpProfiles() {
  return useQuery({
    queryKey: toolsKeys.dumpProfiles(),
    queryFn: () => unwrap(commands.listDumpProfiles()),
  });
}

export function useDeleteDumpProfile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => unwrap(commands.deleteDumpProfile(id)),
    onSuccess: (_, id) => {
      queryClient.setQueryData<DumpProfile[]>(toolsKeys.dumpProfiles(), (profiles) =>
        profiles?.filter((profile) => profile.id !== id),
      );
    },
  });
}

/** Connects if needed, then starts a saved dump. */
export function useRunDumpProfile(ensureConnected: EnsureConnected) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (profile: DumpProfile) => {
      await ensureConnected(profile.connectionId);
      return unwrap(commands.runDumpProfile(profile.id));
    },
    onSuccess: (job) => {
      addStartedJob(queryClient, job);
      void queryClient.invalidateQueries({ queryKey: toolsKeys.dumpProfiles() });
    },
  });
}
