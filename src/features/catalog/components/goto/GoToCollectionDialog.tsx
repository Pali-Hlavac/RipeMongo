import { useHotkey } from "@/shared/hooks/useHotkey";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/shared/ui/dialog";

import { useGoToCollection } from "../../store/goto";
import { useRecordRecentCollections } from "../../store/recent";
import { GoToCollectionList, type ConnectedConnection } from "./GoToCollectionList";

/** Opens "Go to collection" from anywhere. */
export const GO_TO_COLLECTION_HOTKEY = "mod+p";

/**
 * Picker that jumps to any collection or view of the connected connections, recently opened
 * ones first. Mount once; it also records which collection tabs were opened.
 */
export function GoToCollectionDialog({ connections }: { connections: ConnectedConnection[] }) {
  const open = useGoToCollection((state) => state.open);
  const { setOpen, toggle } = useGoToCollection.getState();
  useHotkey(GO_TO_COLLECTION_HOTKEY, toggle);
  useRecordRecentCollections();

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="overflow-hidden p-0" showCloseButton={false}>
        <DialogTitle className="sr-only">Go to collection</DialogTitle>
        <DialogDescription className="sr-only">
          Search the collections and views of the connected connections.
        </DialogDescription>
        {open && (
          <GoToCollectionList
            connections={connections}
            onDone={() => {
              setOpen(false);
            }}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
