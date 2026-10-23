/** Starting dumps, saving them for later and picking where they are saved. */
import { useMutation, useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { open, save } from "@tauri-apps/plugin-dialog";

import { jobKeys } from "@/features/jobs";
import type { DumpRequest, JobInfo } from "@/shared/ipc/bindings";
import { commands, unwrap } from "@/shared/ipc/client";

import { toolsKeys } from "./keys";

const ARCHIVE_FILTERS = [{ name: "mongodump archive", extensions: ["archive", "gz"] }];

/** Asks for a dump folder; `null` when the user cancels. */
export function pickDumpFolder(): Promise<string | null> {
  return open({ multiple: false, directory: true });
}

/** Asks where to save an archive file; `null` when the user cancels. */
export function pickArchivePath(defaultName: string): Promise<string | null> {
  return save({ defaultPath: defaultName, filters: ARCHIVE_FILTERS });
}

/** Adds a just-started job to the list; the job event usually arrives first. */
export function addStartedJob(queryClient: QueryClient, job: JobInfo): void {
  queryClient.setQueryData<JobInfo[]>(jobKeys.list(), (jobs) =>
    jobs?.some((existing) => existing.id === job.id) ? jobs : [job, ...(jobs ?? [])],
  );
}

export interface SubmitDumpInput {
  connectionId: string;
  request: DumpRequest;
  /** Saves the settings as a saved dump (`id: null` for a new one). */
  profile: { id: string | null; name: string } | null;
  /** Start the dump; `false` only saves it. */
  run: boolean;
}

/**
 * Saves (optionally) and starts a dump. Resolves with the started job, or `null` when the
 * dump was only saved.
 */
export function useSubmitDump() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ connectionId, request, profile, run }: SubmitDumpInput) => {
      if (!profile) return unwrap(commands.startDump(connectionId, request));
      const saved = await unwrap(
        commands.saveDumpProfile({ id: profile.id, name: profile.name, connectionId, request }),
      );
      return run ? unwrap(commands.runDumpProfile(saved.id)) : null;
    },
    onSuccess: (job) => {
      if (job) addStartedJob(queryClient, job);
    },
    // Also after a failed run: the saved dump may have been saved before it.
    onSettled: () => queryClient.invalidateQueries({ queryKey: toolsKeys.dumpProfiles() }),
  });
}

/** Collection names of a database, for choosing what a database dump leaves out. */
export function useDumpCollections(connectionId: string, database: string | null) {
  return useQuery({
    queryKey: toolsKeys.collections(connectionId, database),
    queryFn: async () => {
      if (database === null) return [];
      const collections = await unwrap(commands.listCollections(connectionId, database));
      return collections
        .filter((collection) => collection.kind !== "view")
        .map((collection) => collection.name)
        .sort((a, b) => a.localeCompare(b));
    },
    enabled: database !== null,
  });
}
