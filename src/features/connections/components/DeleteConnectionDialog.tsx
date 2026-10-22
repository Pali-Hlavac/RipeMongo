import { ConfirmDialog } from "@/shared/components/ConfirmDialog";

import { useConnections, useDeleteConnection } from "../api/profiles";
import { useConnectionDialogs } from "../store/dialogs";

/**
 * Confirms deleting a saved connection. This removes only RipeMongo's saved settings and
 * keychain entries, never data on the server, so a plain confirmation is enough.
 */
export function DeleteConnectionDialog() {
  const targetId = useConnectionDialogs((state) => state.deleteTargetId);
  const setDeleteTarget = useConnectionDialogs((state) => state.setDeleteTarget);
  const { data: connections = [] } = useConnections();
  const remove = useDeleteConnection();
  const target = connections.find((profile) => profile.id === targetId);

  return (
    <ConfirmDialog
      open={target !== undefined}
      onOpenChange={(open) => {
        if (!open) setDeleteTarget(null);
      }}
      title={`Delete "${target?.name ?? ""}"?`}
      description="The saved settings and stored passwords of this connection are removed from this computer. Data on the server is not affected."
      confirmLabel="Delete connection"
      destructive
      pending={remove.isPending}
      onConfirm={() => {
        if (!target) return;
        remove.mutate(target.id, {
          onSuccess: () => {
            setDeleteTarget(null);
          },
        });
      }}
    />
  );
}
