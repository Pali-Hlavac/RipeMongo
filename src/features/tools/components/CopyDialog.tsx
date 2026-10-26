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

import { useStartCopy } from "../api/copy";
import type { EnsureConnected } from "../api/profiles";
import {
  buildCopyRequest,
  copyScope,
  initialCopyValues,
  targetName,
  validateCopyForm,
  withTargetConnection,
  type CopyFormErrors,
  type CopyFormValues,
} from "../lib/copy";
import { useCopyDialog, type CopyTarget } from "../store/transfer";
import { CopyOptionsFields } from "./CopyOptionsFields";
import { CopyTargetFields } from "./CopyTargetFields";

/** Copy dialog for a database or collection; mount once at the app root. */
export function CopyDialog({ ensureConnected }: { ensureConnected: EnsureConnected }) {
  const target = useCopyDialog((state) => state.target);
  const close = useCopyDialog((state) => state.close);
  return (
    <Dialog
      open={target !== null}
      onOpenChange={(open) => {
        if (!open) close();
      }}
    >
      {/* Keyed so every opening starts from a fresh form. */}
      {target && (
        <CopyForm
          key={JSON.stringify(target)}
          target={target}
          ensureConnected={ensureConnected}
          onDone={close}
        />
      )}
    </Dialog>
  );
}

interface CopyFormProps {
  target: CopyTarget;
  ensureConnected: EnsureConnected;
  onDone: () => void;
}

function CopyForm({ target, ensureConnected, onDone }: CopyFormProps) {
  const [values, setValues] = useState(() => initialCopyValues(target));
  const [errors, setErrors] = useState<CopyFormErrors>({});
  const [confirming, setConfirming] = useState(false);
  const formId = useId();
  const closing = useAfterDialogClose();
  const start = useStartCopy(ensureConnected);
  const tools = useToolsInfo();
  const missing = tools.data?.tools.some(
    (tool) => (tool.tool === "mongodump" || tool.tool === "mongorestore") && !tool.version,
  );
  const scope = copyScope(target);
  const name = targetName(target, values);

  const change = (patch: Partial<CopyFormValues>) => {
    setValues((current) => ({ ...current, ...patch }));
    setErrors({});
  };

  const run = () => {
    setConfirming(false);
    start.mutate(
      {
        connectionId: target.connectionId,
        targetConnectionId: values.targetConnectionId,
        request: buildCopyRequest(target, values),
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
    const found = validateCopyForm(target, values);
    setErrors(found);
    if (Object.keys(found).length > 0) return;
    if (values.drop) setConfirming(true);
    else run();
  };

  return (
    <DialogContent
      className="flex max-h-[90vh] max-w-lg flex-col"
      onCloseAutoFocus={closing.onCloseAutoFocus}
    >
      <DialogHeader>
        <DialogTitle>Copy {scope}</DialogTitle>
        <DialogDescription>
          Copies the documents, indexes and options of {scope} into another connection, or into this
          one under another name. Nothing is saved on disk. You can keep working while it runs.
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
        <CopyTargetFields
          target={target}
          values={values}
          errors={errors}
          onConnectionChange={(connectionId) => {
            setValues((current) => withTargetConnection(target, current, connectionId));
            setErrors({});
          }}
          onChange={change}
        />
        <CopyOptionsFields target={target} values={values} onChange={change} />
      </form>
      {/* Outside the scrolling form so the buttons and errors always stay visible. */}
      {missing && (
        <InlineError
          error={{
            code: "NOT_FOUND",
            message: "mongodump or mongorestore is not included in this build of RipeMongo.",
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
          disabled={start.isPending || missing === true}
        >
          {values.drop ? "Replace and copy" : "Start copy"}
        </Button>
      </div>
      <ConfirmByTypingDialog
        open={confirming}
        onOpenChange={setConfirming}
        title="Replace and copy?"
        description={
          target.collection === null ? (
            <>
              Each collection copied into <strong>{name}</strong> is deleted there first, with its
              documents and indexes. This cannot be undone.
            </>
          ) : (
            <>
              <strong>{`${values.database.trim()}.${name}`}</strong> is deleted in the target first,
              with its documents and indexes. This cannot be undone.
            </>
          )
        }
        confirmText={name}
        confirmLabel="Replace and copy"
        pending={start.isPending}
        onConfirm={run}
      />
    </DialogContent>
  );
}
