import { useId, useState } from "react";

import { useToolsInfo } from "@/features/about";
import { useJobsPanel } from "@/features/jobs";
import { ConfirmByTypingDialog } from "@/shared/components/ConfirmByTypingDialog";
import { InlineError } from "@/shared/components/InlineError";
import { useAfterDialogClose } from "@/shared/hooks/useAfterDialogClose";
import type { RestoreSource } from "@/shared/ipc/bindings";
import { Button } from "@/shared/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/shared/ui/dialog";

import { pickRestoreSource, useDumpContents, useStartRestore } from "../api/restore";
import {
  buildRestoreRequest,
  canReplayOplog,
  initialRestoreValues,
  validateRestoreForm,
  type RestoreFormErrors,
  type RestoreFormValues,
} from "../lib/restore";
import { useRestoreDialog, type RestoreTarget } from "../store/dump";
import { DumpOutputField } from "./DumpOutputField";
import { RestoreContentsField } from "./RestoreContentsField";
import { RestoreOptionsFields } from "./RestoreOptionsFields";

const SOURCE_DESCRIPTIONS = {
  folder: "A dump folder with one sub-folder per database.",
  archive: "A single archive file made by mongodump, compressed or not.",
};

/** Restore dialog for the connection chosen in the sidebar; mount once at the app root. */
export function RestoreDialog() {
  const target = useRestoreDialog((state) => state.target);
  const close = useRestoreDialog((state) => state.close);
  return (
    <Dialog
      open={target !== null}
      onOpenChange={(open) => {
        if (!open) close();
      }}
    >
      {target && <RestoreForm key={target.connectionId} target={target} onDone={close} />}
    </Dialog>
  );
}

function RestoreForm({ target, onDone }: { target: RestoreTarget; onDone: () => void }) {
  const [values, setValues] = useState<RestoreFormValues>(initialRestoreValues);
  const [errors, setErrors] = useState<RestoreFormErrors>({});
  // The source that was read; set when a path is picked or typed and left.
  const [source, setSource] = useState<RestoreSource | null>(null);
  const [confirming, setConfirming] = useState(false);
  const formId = useId();
  const closing = useAfterDialogClose();
  const contents = useDumpContents(source);
  const start = useStartRestore();
  const tools = useToolsInfo();
  const missing = tools.data?.tools.some((tool) => tool.tool === "mongorestore" && !tool.version);
  const canReplay = canReplayOplog(contents.data, values);

  const change = (patch: Partial<RestoreFormValues>) => {
    setValues((current) => ({ ...current, ...patch }));
    setErrors({});
  };
  const read = (path: string) => {
    const trimmed = path.trim();
    if (trimmed === "" || (source?.kind === values.kind && source.path === trimmed)) return;
    setSource({ kind: values.kind, path: trimmed });
    change({ excluded: [], renames: {} });
  };

  const browse = async () => {
    const picked = await pickRestoreSource(values.kind);
    if (!picked) return;
    change({ path: picked, excluded: [], renames: {} });
    setSource({ kind: values.kind, path: picked });
  };

  const run = () => {
    setConfirming(false);
    start.mutate(
      { connectionId: target.connectionId, request: buildRestoreRequest(values, contents.data) },
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
    const found = validateRestoreForm(values);
    setErrors(found);
    if (Object.keys(found).length > 0 || !contents.data) return;
    if (values.drop && !values.dryRun) setConfirming(true);
    else run();
  };

  return (
    <DialogContent
      className="flex max-h-[90vh] max-w-lg flex-col"
      onCloseAutoFocus={closing.onCloseAutoFocus}
    >
      <DialogHeader>
        <DialogTitle>Restore into {target.connectionName}</DialogTitle>
        <DialogDescription>
          Loads a dump made by mongodump into this server. You can keep working while it runs.
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
        <DumpOutputField
          kind={values.kind}
          path={values.path}
          error={errors.path ?? null}
          legend="Restore from"
          descriptions={SOURCE_DESCRIPTIONS}
          name="restore-source"
          onKindChange={(kind) => {
            change({ kind, path: "", excluded: [], renames: {} });
            setSource(null);
          }}
          onPathChange={(path) => {
            change({ path });
          }}
          onPathCommit={() => {
            read(values.path);
          }}
          onBrowse={() => void browse()}
        />
        <RestoreContentsField
          contents={contents.data}
          loading={contents.isFetching && !contents.data}
          error={contents.error}
          values={values}
          onChange={change}
        />
        {contents.data && (
          <RestoreOptionsFields
            values={values}
            hasOplog={contents.data.oplog}
            canReplay={canReplay}
            parallelError={errors.parallel ?? null}
            onChange={change}
          />
        )}
      </form>
      {/* Outside the scrolling form so the buttons and errors always stay visible. */}
      {missing && (
        <InlineError
          error={{
            code: "NOT_FOUND",
            message: "mongorestore is not included in this build of RipeMongo.",
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
          variant={values.drop && !values.dryRun ? "destructive" : "default"}
          disabled={start.isPending || missing === true || !contents.data}
        >
          {values.dryRun ? "Start dry run" : "Restore"}
        </Button>
      </div>
      <ConfirmByTypingDialog
        open={confirming}
        onOpenChange={setConfirming}
        title="Drop and restore?"
        description={
          <>
            Each collection being restored is dropped on <strong>{target.connectionName}</strong>{" "}
            first and replaced by the copy in the dump. This cannot be undone.
          </>
        }
        confirmText={target.connectionName}
        confirmLabel="Drop and restore"
        pending={start.isPending}
        onConfirm={run}
      />
    </DialogContent>
  );
}
