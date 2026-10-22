/** Starting dumps and picking where they are saved. */
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { open, save } from "@tauri-apps/plugin-dialog";

import { jobKeys } from "@/features/jobs";
import type { DumpRequest, JobInfo } from "@/shared/ipc/bindings";
import { commands, unwrap } from "@/shared/ipc/client";

const ARCHIVE_FILTERS = [{ name: "mongodump archive", extensions: ["archive", "gz"] }];

/** Asks for a dump folder; `null` when the user cancels. */
export function pickDumpFolder(): Promise<string | null> {
  return open({ multiple: false, directory: true });
}

/** Asks where to save an archive file; `null` when the user cancels. */
export function pickArchivePath(defaultName: string): Promise<string | null> {
  return save({ defaultPath: defaultName, filters: ARCHIVE_FILTERS });
}

interface StartDumpInput {
  connectionId: string;
  request: DumpRequest;
}

/** Starts `mongodump` as a background job; resolves with the job once it is running. */
export function useStartDump() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ connectionId, request }: StartDumpInput) =>
      unwrap(commands.startDump(connectionId, request)),
    onSuccess: (job) => {
      // The job event usually arrives first; this covers a missed one.
      queryClient.setQueryData<JobInfo[]>(jobKeys.list(), (jobs) =>
        jobs?.some((existing) => existing.id === job.id) ? jobs : [job, ...(jobs ?? [])],
      );
    },
  });
}
