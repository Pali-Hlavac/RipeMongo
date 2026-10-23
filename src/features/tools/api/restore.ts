/** Reading dumps and starting restores. */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { open } from "@tauri-apps/plugin-dialog";

import type { RestoreRequest, RestoreSource } from "@/shared/ipc/bindings";
import { commands, unwrap } from "@/shared/ipc/client";

import { addStartedJob } from "./dump";
import { toolsKeys } from "./keys";

const ARCHIVE_FILTERS = [
  { name: "mongodump archive", extensions: ["archive", "gz"] },
  { name: "All files", extensions: ["*"] },
];

/** Asks for the dump folder or archive to restore; `null` when the user cancels. */
export function pickRestoreSource(kind: RestoreSource["kind"]): Promise<string | null> {
  return kind === "folder"
    ? open({ multiple: false, directory: true })
    : open({ multiple: false, directory: false, filters: ARCHIVE_FILTERS });
}

/** What a dump contains; `source: null` until a path has been chosen. */
export function useDumpContents(source: RestoreSource | null) {
  return useQuery({
    queryKey: toolsKeys.dumpContents(source),
    queryFn: () => {
      if (source === null) throw new Error("No dump chosen.");
      return unwrap(commands.inspectDump(source));
    },
    enabled: source !== null,
    // The dump may change on disk (a new dump into the same folder).
    staleTime: 0,
  });
}

interface StartRestoreInput {
  connectionId: string;
  request: RestoreRequest;
}

/** Starts `mongorestore` as a background job. */
export function useStartRestore() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ connectionId, request }: StartRestoreInput) =>
      unwrap(commands.startRestore(connectionId, request)),
    onSuccess: (job) => {
      addStartedJob(queryClient, job);
    },
  });
}
