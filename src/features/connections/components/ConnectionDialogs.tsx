import { DeleteConnectionDialog } from "./DeleteConnectionDialog";
import { ConnectionEditorDialog } from "./editor/ConnectionEditorDialog";
import { TransferDialog } from "./transfer/TransferDialog";

/** Every dialog of the connections feature; mount once at the app root. */
export function ConnectionDialogs() {
  return (
    <>
      <ConnectionEditorDialog />
      <DeleteConnectionDialog />
      <TransferDialog />
    </>
  );
}
