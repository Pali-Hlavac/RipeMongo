import { useQueryClient } from "@tanstack/react-query";
import { ArchiveIcon, DatabaseIcon, HistoryIcon, RefreshCwIcon } from "lucide-react";

import { useDumpDialog, useSavedDumpsDialog } from "@/features/tools";

import { DropdownMenuItem } from "@/shared/ui/dropdown-menu";

import { catalogKeys } from "../api/keys";
import { useCatalogDialogs } from "../store/dialogs";

/** Catalog entries for a connected connection's "⋯" menu. */
export function CatalogConnectionMenuItems({ connectionId }: { connectionId: string }) {
  const queryClient = useQueryClient();
  const open = useCatalogDialogs((state) => state.open);
  return (
    <>
      <DropdownMenuItem
        onSelect={() => {
          open({ type: "createDatabase", connectionId });
        }}
      >
        <DatabaseIcon aria-hidden /> Create database…
      </DropdownMenuItem>
      <DropdownMenuItem
        onSelect={() => {
          useDumpDialog.getState().open({ connectionId, database: null, collection: null });
        }}
      >
        <ArchiveIcon aria-hidden /> Dump all databases…
      </DropdownMenuItem>
      <DropdownMenuItem
        onSelect={() => {
          useSavedDumpsDialog.getState().setOpen(true);
        }}
      >
        <HistoryIcon aria-hidden /> Saved dumps…
      </DropdownMenuItem>
      <DropdownMenuItem
        onSelect={() => {
          void queryClient.invalidateQueries({ queryKey: catalogKeys.connection(connectionId) });
        }}
      >
        <RefreshCwIcon aria-hidden /> Refresh databases
      </DropdownMenuItem>
    </>
  );
}
