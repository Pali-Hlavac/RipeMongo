/** Reading files before an import and starting imports. */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { open } from "@tauri-apps/plugin-dialog";

import type { ImportRequest } from "@/shared/ipc/bindings";
import { commands, unwrap } from "@/shared/ipc/client";

import { addStartedJob } from "./dump";
import { toolsKeys } from "./keys";

const FILTERS = [
  { name: "JSON or CSV", extensions: ["json", "jsonl", "ndjson", "csv", "tsv", "txt"] },
  { name: "All files", extensions: ["*"] },
];

/** Asks for the file to import; `null` when the user cancels. */
export function pickImportFile(): Promise<string | null> {
  return open({ multiple: false, directory: false, filters: FILTERS });
}

/** The chosen file; `delimiter: null` uses the detected one. */
export interface ImportFile {
  path: string;
  delimiter: string | null;
}

/** Format, columns and samples of the file; `file: null` until one has been chosen. */
export function useImportPreview(file: ImportFile | null) {
  return useQuery({
    queryKey: toolsKeys.importPreview(file?.path ?? null, file?.delimiter ?? null),
    queryFn: () => {
      if (file === null) throw new Error("No file chosen.");
      return unwrap(commands.inspectImportFile(file.path, file.delimiter));
    },
    enabled: file !== null,
    // The file may change on disk between two imports.
    staleTime: 0,
  });
}

/** Starts `mongoimport` as a background job. */
export function useStartImport() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ connectionId, request }: { connectionId: string; request: ImportRequest }) =>
      unwrap(commands.startImport(connectionId, request)),
    onSuccess: (job) => {
      addStartedJob(queryClient, job);
    },
  });
}
