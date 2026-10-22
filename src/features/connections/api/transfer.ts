/** Import/export of connection files plus the native file pickers they need. */
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { open, save } from "@tauri-apps/plugin-dialog";

import { commands, unwrap } from "@/shared/ipc/client";

import { connectionKeys } from "./keys";

const FILE_FILTERS = [{ name: "RipeMongo connections", extensions: ["json"] }];
const DEFAULT_EXPORT_NAME = "ripemongo-connections.json";

/** Asks where to save an export; `null` when the user cancels. */
export function pickExportPath(): Promise<string | null> {
  return save({ defaultPath: DEFAULT_EXPORT_NAME, filters: FILE_FILTERS });
}

/** Asks for a connections file to import; `null` when the user cancels. */
export function pickImportPath(): Promise<string | null> {
  return open({ multiple: false, directory: false, filters: FILE_FILTERS });
}

/** Reads the header of a connections file before importing. */
export function inspectConnectionsFile(path: string) {
  return unwrap(commands.inspectConnectionsFile(path));
}

interface ExportInput {
  path: string;
  connectionIds: string[];
  password: string | null;
}

export function useExportConnections() {
  return useMutation({
    mutationFn: ({ path, connectionIds, password }: ExportInput) =>
      unwrap(commands.exportConnections(path, connectionIds, password)),
  });
}

interface ImportInput {
  path: string;
  password: string | null;
}

export function useImportConnections() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ path, password }: ImportInput) =>
      unwrap(commands.importConnections(path, password)),
    meta: { silent: true },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: connectionKeys.list() });
    },
  });
}
