import { ConfirmByTypingDialog } from "@/shared/components/ConfirmByTypingDialog";

import { useDropCollection, useDropDatabase } from "../../api/mutations";
import { useCatalogDialog, useCatalogDialogs } from "../../store/dialogs";

/** Drop a database: irreversible, so the name has to be typed. */
export function DropDatabaseDialog() {
  const dialog = useCatalogDialog("dropDatabase");
  const close = useCatalogDialogs((state) => state.close);
  const drop = useDropDatabase();
  const database = dialog?.database ?? "";

  return (
    <ConfirmByTypingDialog
      open={dialog !== null}
      onOpenChange={(open) => {
        if (open) return;
        drop.reset();
        close();
      }}
      title={`Drop database "${database}"?`}
      description="Every collection, view, index and document in it is deleted permanently. This cannot be undone."
      confirmText={database}
      confirmLabel="Drop database"
      pending={drop.isPending}
      error={drop.error}
      onConfirm={() => {
        if (!dialog) return;
        drop.mutate(dialog, { onSuccess: close });
      }}
    />
  );
}

/** Drop a collection or view: irreversible, so the name has to be typed. */
export function DropCollectionDialog() {
  const dialog = useCatalogDialog("dropCollection");
  const close = useCatalogDialogs((state) => state.close);
  const drop = useDropCollection();
  const collection = dialog?.collection ?? "";
  const isView = dialog?.kind === "view";

  return (
    <ConfirmByTypingDialog
      open={dialog !== null}
      onOpenChange={(open) => {
        if (open) return;
        drop.reset();
        close();
      }}
      title={isView ? `Drop view "${collection}"?` : `Drop collection "${collection}"?`}
      description={
        isView
          ? "The view definition is deleted. The documents of its source collection are not affected."
          : "All its documents and indexes are deleted permanently. This cannot be undone."
      }
      confirmText={collection}
      confirmLabel={isView ? "Drop view" : "Drop collection"}
      pending={drop.isPending}
      error={drop.error}
      onConfirm={() => {
        if (!dialog) return;
        drop.mutate(dialog, { onSuccess: close });
      }}
    />
  );
}
