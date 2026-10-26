import { useId, useState } from "react";

import { useToolsInfo } from "@/features/about";
import { useJobsPanel } from "@/features/jobs";
import { ConfirmByTypingDialog } from "@/shared/components/ConfirmByTypingDialog";
import { InlineError } from "@/shared/components/InlineError";
import { useAfterDialogClose } from "@/shared/hooks/useAfterDialogClose";
import { Button } from "@/shared/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/shared/ui/dialog";

import { pickImportFile, useImportPreview, useStartImport, type ImportFile } from "../api/import";
import {
  buildImportRequest,
  collectionFromPath,
  initialImportValues,
  validateImportForm,
  type ImportFormErrors,
  type ImportFormValues,
} from "../lib/import";
import { useImportDialog, type ImportTarget } from "../store/transfer";
import { ImportColumnsField } from "./ImportColumnsField";
import { ImportFileFields } from "./ImportFileFields";
import { ImportCsvFields, ImportOptionsFields } from "./ImportOptionsFields";
import { ImportSpeedFields } from "./ImportSpeedFields";

/** Import dialog for a collection or a new collection; mount once at the app root. */
export function ImportDialog() {
  const target = useImportDialog((state) => state.target);
  const close = useImportDialog((state) => state.close);
  return (
    <Dialog
      open={target !== null}
      onOpenChange={(open) => {
        if (!open) close();
      }}
    >
      {/* Keyed so every opening starts from a fresh form. */}
      {target && <ImportForm key={JSON.stringify(target)} target={target} onDone={close} />}
    </Dialog>
  );
}

function ImportForm({ target, onDone }: { target: ImportTarget; onDone: () => void }) {
  const [values, setValues] = useState(() => initialImportValues(target));
  const [file, setFile] = useState<ImportFile | null>(null);
  const [errors, setErrors] = useState<ImportFormErrors>({});
  const [confirming, setConfirming] = useState(false);
  const formId = useId();
  const closing = useAfterDialogClose();
  const preview = useImportPreview(file);
  const start = useStartImport();
  const tools = useToolsInfo();
  const missing = tools.data?.tools.some((tool) => tool.tool === "mongoimport" && !tool.version);
  const creating = target.collection === null;
  const collection = values.collection.trim();

  const change = (patch: Partial<ImportFormValues>) => {
    setValues((current) => ({ ...current, ...patch }));
    setErrors({});
  };
  const read = (path: string) => {
    const trimmed = path.trim();
    if (trimmed === "" || file?.path === trimmed) return;
    setFile({ path: trimmed, delimiter: null });
    setValues((current) => ({
      ...current,
      path: trimmed,
      columnEdits: {},
      collection:
        creating && !current.collectionEdited ? collectionFromPath(trimmed) : current.collection,
    }));
    setErrors({});
  };
  const browse = async () => {
    const picked = await pickImportFile();
    if (picked) read(picked);
  };

  const run = () => {
    setConfirming(false);
    if (!preview.data) return;
    start.mutate(
      {
        connectionId: target.connectionId,
        request: buildImportRequest(target, values, preview.data),
      },
      {
        onSuccess: () => {
          closing.after(() => {
            useJobsPanel.getState().setOpen(true);
          });
          onDone();
        },
      },
    );
  };

  const submit = () => {
    const found = validateImportForm(values, preview.data);
    setErrors(found);
    if (Object.keys(found).length > 0 || !preview.data) return;
    if (values.drop) setConfirming(true);
    else run();
  };

  return (
    <DialogContent
      className="flex max-h-[90vh] max-w-2xl flex-col"
      onCloseAutoFocus={closing.onCloseAutoFocus}
    >
      <DialogHeader>
        <DialogTitle>
          {creating
            ? `Import into ${target.database}`
            : `Import into ${target.database}.${collection}`}
        </DialogTitle>
        <DialogDescription>
          Adds documents from a JSON or CSV file with mongoimport. You can keep working while it
          runs.
        </DialogDescription>
      </DialogHeader>
      <form
        id={formId}
        className="-mx-1 grid min-h-0 gap-4 overflow-auto px-1"
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          submit();
        }}
      >
        <ImportFileFields
          values={values}
          errors={errors}
          creating={creating}
          preview={preview.data}
          loading={preview.isFetching && !preview.data}
          previewError={preview.error}
          onChange={change}
          onCommit={() => {
            read(values.path);
          }}
          onBrowse={() => void browse()}
        />
        {preview.data?.format === "csv" && file && (
          <>
            <ImportCsvFields
              preview={preview.data}
              values={values}
              onDelimiterChange={(delimiter) => {
                setFile({ ...file, delimiter });
                change({ columnEdits: {} });
              }}
              onChange={change}
            >
              <ImportColumnsField
                preview={preview.data}
                values={values}
                error={errors.columns ?? null}
                onChange={change}
              />
            </ImportCsvFields>
          </>
        )}
        {preview.data && (
          <>
            <ImportOptionsFields values={values} onChange={change} />
            <ImportSpeedFields
              values={values}
              workersError={errors.workers ?? null}
              onChange={change}
            />
          </>
        )}
      </form>
      {/* Outside the scrolling form so the buttons and errors always stay visible. */}
      {missing && (
        <InlineError
          error={{
            code: "NOT_FOUND",
            message: "mongoimport is not included in this build of RipeMongo.",
            hint: "Reinstall RipeMongo. If you built it yourself, run `pnpm sidecars` first.",
          }}
        />
      )}
      {start.error && <InlineError error={start.error} />}
      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" onClick={onDone}>
          Cancel
        </Button>
        <Button
          type="submit"
          form={formId}
          variant={values.drop ? "destructive" : "default"}
          disabled={start.isPending || missing === true || !preview.data}
        >
          {values.drop ? "Drop and import" : "Start import"}
        </Button>
      </div>
      <ConfirmByTypingDialog
        open={confirming}
        onOpenChange={setConfirming}
        title="Drop and import?"
        description={
          <>
            Every document and index of <strong>{`${target.database}.${collection}`}</strong> is
            deleted before the file is imported. This cannot be undone.
          </>
        }
        confirmText={collection}
        confirmLabel="Drop and import"
        pending={start.isPending}
        onConfirm={run}
      />
    </DialogContent>
  );
}
