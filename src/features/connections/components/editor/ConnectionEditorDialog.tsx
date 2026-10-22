import { LoadingState } from "@/shared/components/LoadingState";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/shared/ui/dialog";

import { useConnections, useStoredSecrets } from "../../api/profiles";
import { newProfile } from "../../lib/defaults";
import { folderNames } from "../../lib/tree";
import { useConnectionDialogs } from "../../store/dialogs";
import { ConnectionEditor } from "./ConnectionEditor";

/** "New connection" / "Edit connection" dialog, driven by the dialogs store. */
export function ConnectionEditorDialog() {
  const editor = useConnectionDialogs((state) => state.editor);
  const closeEditor = useConnectionDialogs((state) => state.closeEditor);
  const { data: connections = [] } = useConnections();
  const editingId = editor.mode === "edit" ? editor.connectionId : null;
  const stored = useStoredSecrets(editingId);

  const existing = connections.find((profile) => profile.id === editingId);
  const initial = editor.mode === "edit" ? existing : newProfile();
  const ready = initial !== undefined && (editingId === null || !stored.isPending);

  return (
    <Dialog
      open={editor.mode !== "closed"}
      onOpenChange={(open) => {
        if (!open) closeEditor();
      }}
    >
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editor.mode === "edit" ? "Edit connection" : "New connection"}</DialogTitle>
          <DialogDescription>
            Connection settings are saved locally; passwords go to the system keychain.
          </DialogDescription>
        </DialogHeader>
        {ready ? (
          <ConnectionEditor
            key={editingId ?? "new"}
            initial={initial}
            stored={stored.data}
            folders={folderNames(connections)}
            onDone={closeEditor}
          />
        ) : (
          <LoadingState label="Loading connection…" />
        )}
      </DialogContent>
    </Dialog>
  );
}
