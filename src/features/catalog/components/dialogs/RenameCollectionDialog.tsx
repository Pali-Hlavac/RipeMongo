import { useState } from "react";

import { FormField } from "@/shared/ui/form-field";
import { Input } from "@/shared/ui/input";

import { useRenameCollection } from "../../api/mutations";
import { collectionNameError } from "../../lib/names";
import { useCatalogDialog, useCatalogDialogs, type CatalogDialog } from "../../store/dialogs";
import { FormDialog } from "./FormDialog";

type Target = Extract<CatalogDialog, { type: "renameCollection" }>;

/** Renames a collection within its database; an open tab follows the new name. */
export function RenameCollectionDialog() {
  const dialog = useCatalogDialog("renameCollection");
  return dialog && <RenameCollectionForm target={dialog} />;
}

function RenameCollectionForm({ target }: { target: Target }) {
  const { connectionId, database, collection } = target;
  const close = useCatalogDialogs((state) => state.close);
  const rename = useRenameCollection();
  const [newName, setNewName] = useState(collection);
  const error = newName === collection ? null : collectionNameError(newName);

  return (
    <FormDialog
      open
      onClose={close}
      title={`Rename "${collection}"`}
      description="Indexes and documents are kept. Applications that use the old name stop finding it."
      submitLabel="Rename"
      canSubmit={newName !== collection && error === null}
      pending={rename.isPending}
      error={rename.error}
      onSubmit={() => {
        rename.mutate({ connectionId, database, collection, newName }, { onSuccess: close });
      }}
    >
      <FormField label="New name" error={error}>
        {(control) => (
          <Input
            {...control}
            autoComplete="off"
            spellCheck={false}
            value={newName}
            onFocus={(event) => {
              event.target.select();
            }}
            onChange={(event) => {
              setNewName(event.target.value);
            }}
          />
        )}
      </FormField>
    </FormDialog>
  );
}
