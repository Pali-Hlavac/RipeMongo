import { Dialog, DialogContent } from "@/shared/ui/dialog";

import { useConnectionDialogs } from "../../store/dialogs";
import { ExportConnectionsDialog } from "./ExportConnectionsDialog";
import { ImportConnectionsDialog } from "./ImportConnectionsDialog";

/** Hosts the import or export dialog, whichever the dialogs store asks for. */
export function TransferDialog() {
  const mode = useConnectionDialogs((state) => state.transfer);
  const setTransfer = useConnectionDialogs((state) => state.setTransfer);
  const close = () => {
    setTransfer(null);
  };

  return (
    <Dialog
      open={mode !== null}
      onOpenChange={(open) => {
        if (!open) close();
      }}
    >
      <DialogContent className="max-w-lg">
        {mode === "export" && <ExportConnectionsDialog onDone={close} />}
        {mode === "import" && <ImportConnectionsDialog onDone={close} />}
      </DialogContent>
    </Dialog>
  );
}
