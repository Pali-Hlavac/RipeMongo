/** Starting exports, the field names offered for them and picking the file. */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { save } from "@tauri-apps/plugin-dialog";

import type { ExportFormat, ExportRequest } from "@/shared/ipc/bindings";
import { commands, unwrap } from "@/shared/ipc/client";

import { addStartedJob } from "./dump";
import { toolsKeys } from "./keys";

const FILTERS: Record<ExportFormat, { name: string; extensions: string[] }[]> = {
  json: [{ name: "JSON", extensions: ["json"] }],
  csv: [{ name: "CSV", extensions: ["csv"] }],
};

/** Asks where to save the export; `null` when the user cancels. */
export function pickExportPath(defaultName: string, format: ExportFormat): Promise<string | null> {
  return save({ defaultPath: defaultName, filters: FILTERS[format] });
}

/** Field names and nested paths from a random sample of the collection's documents. */
export function useSampledFields(connectionId: string, database: string, collection: string) {
  return useQuery({
    queryKey: toolsKeys.fields(connectionId, database, collection),
    queryFn: () => unwrap(commands.sampleFields(connectionId, database, collection)),
  });
}

/** Starts an export job. */
export function useStartExport() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ connectionId, request }: { connectionId: string; request: ExportRequest }) =>
      unwrap(commands.startExport(connectionId, request)),
    onSuccess: (job) => {
      addStartedJob(queryClient, job);
    },
  });
}
