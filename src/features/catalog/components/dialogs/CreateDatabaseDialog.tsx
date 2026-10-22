import { useState } from "react";

import { FormField } from "@/shared/ui/form-field";
import { Input } from "@/shared/ui/input";

import { useCreateDatabase } from "../../api/mutations";
import { collectionNameError, databaseNameError } from "../../lib/names";
import { useCatalogDialog, useCatalogDialogs } from "../../store/dialogs";
import { FormDialog } from "@/shared/components/FormDialog";

/** New database plus its first collection (MongoDB only stores databases that have one). */
export function CreateDatabaseDialog() {
  const dialog = useCatalogDialog("createDatabase");
  // The form unmounts on close, so every opening starts empty.
  return dialog && <CreateDatabaseForm connectionId={dialog.connectionId} />;
}

function CreateDatabaseForm({ connectionId }: { connectionId: string }) {
  const close = useCatalogDialogs((state) => state.close);
  const create = useCreateDatabase();
  const [database, setDatabase] = useState("");
  const [collection, setCollection] = useState("");
  const databaseError = databaseNameError(database);
  const collectionError = collectionNameError(collection);

  return (
    <FormDialog
      open
      onClose={close}
      title="Create database"
      description="MongoDB keeps a database only while it has at least one collection, so name its first collection too."
      submitLabel="Create database"
      canSubmit={!databaseError && !collectionError}
      pending={create.isPending}
      error={create.error}
      onSubmit={() => {
        create.mutate({ connectionId, database, collection }, { onSuccess: close });
      }}
    >
      <FormField label="Database name" error={database ? databaseError : null}>
        {(control) => (
          <Input
            {...control}
            autoComplete="off"
            spellCheck={false}
            value={database}
            onChange={(event) => {
              setDatabase(event.target.value);
            }}
          />
        )}
      </FormField>
      <FormField label="First collection name" error={collection ? collectionError : null}>
        {(control) => (
          <Input
            {...control}
            autoComplete="off"
            spellCheck={false}
            value={collection}
            onChange={(event) => {
              setCollection(event.target.value);
            }}
          />
        )}
      </FormField>
    </FormDialog>
  );
}
