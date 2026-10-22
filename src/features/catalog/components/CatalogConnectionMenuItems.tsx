import { useQueryClient } from "@tanstack/react-query";
import { DatabaseIcon, RefreshCwIcon } from "lucide-react";

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
          void queryClient.invalidateQueries({ queryKey: catalogKeys.connection(connectionId) });
        }}
      >
        <RefreshCwIcon aria-hidden /> Refresh databases
      </DropdownMenuItem>
    </>
  );
}
