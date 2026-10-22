import { useState } from "react";

import { FormField } from "@/shared/ui/form-field";
import { Input } from "@/shared/ui/input";

import { useCreateCollection, useCreateView } from "../../api/mutations";
import {
  newCollectionDraft,
  toRequest,
  validateDraft,
  type NewCollectionDraft,
} from "../../lib/new-collection";
import { useCatalogDialog, useCatalogDialogs, type CatalogDialog } from "../../store/dialogs";
import { CollectionKindFields, KindPicker } from "./CollectionKindFields";
import { FormDialog } from "@/shared/components/FormDialog";

type Target = Extract<CatalogDialog, { type: "createCollection" }>;

/** New standard, capped or time-series collection, or a view. */
export function CreateCollectionDialog() {
  const dialog = useCatalogDialog("createCollection");
  return dialog && <CreateCollectionForm target={dialog} />;
}

function CreateCollectionForm({ target }: { target: Target }) {
  const { connectionId, database } = target;
  const close = useCatalogDialogs((state) => state.close);
  const createCollection = useCreateCollection();
  const createView = useCreateView();
  const [draft, setDraft] = useState(() => newCollectionDraft(target.viewOn));
  const errors = validateDraft(draft);
  const isView = draft.kind === "view";
  const mutation = isView ? createView : createCollection;

  const update = (patch: Partial<NewCollectionDraft>) => {
    setDraft((current) => ({ ...current, ...patch }));
  };

  const submit = () => {
    const request = toRequest(draft);
    if (request.type === "view") {
      createView.mutate({ connectionId, database, view: request.view }, { onSuccess: close });
    } else {
      createCollection.mutate(
        { connectionId, database, collection: request.name, options: request.options },
        { onSuccess: close },
      );
    }
  };

  return (
    <FormDialog
      open
      onClose={close}
      title={isView ? "Create view" : "Create collection"}
      description={
        <>
          In database <span className="font-mono text-foreground">{database}</span>.
        </>
      }
      submitLabel={isView ? "Create view" : "Create collection"}
      canSubmit={Object.keys(errors).length === 0}
      pending={mutation.isPending}
      error={mutation.error}
      onSubmit={submit}
      className="max-w-lg"
    >
      <FormField
        label={isView ? "View name" : "Collection name"}
        error={draft.name ? errors.name : null}
      >
        {(control) => (
          <Input
            {...control}
            autoComplete="off"
            spellCheck={false}
            value={draft.name}
            onChange={(event) => {
              update({ name: event.target.value });
            }}
          />
        )}
      </FormField>
      <KindPicker
        value={draft.kind}
        onChange={(kind) => {
          createCollection.reset();
          createView.reset();
          update({ kind });
        }}
      />
      <CollectionKindFields
        connectionId={connectionId}
        database={database}
        draft={draft}
        errors={errors}
        onChange={update}
      />
    </FormDialog>
  );
}
