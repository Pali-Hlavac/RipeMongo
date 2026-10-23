import { useState } from "react";
import { toast } from "sonner";

import { useToolsInfo } from "@/features/about";
import { useJobsPanel } from "@/features/jobs";
import { InlineError } from "@/shared/components/InlineError";
import { useAfterDialogClose } from "@/shared/hooks/useAfterDialogClose";
import type { DumpProfile } from "@/shared/ipc/bindings";
import { Button } from "@/shared/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/shared/ui/dialog";

import { pickArchivePath, pickDumpFolder, useSubmitDump } from "../api/dump";
import {
  buildDumpRequest,
  defaultArchiveName,
  dumpScope,
  dumpScopeKind,
  initialDumpValues,
  validateDumpForm,
  type DumpFormErrors,
  type DumpFormValues,
} from "../lib/dump";
import { useDumpDialog, useSavedDumpsDialog, type DumpTarget } from "../store/dump";
import { DumpOptionsFields } from "./DumpOptionsFields";
import { DumpOutputField } from "./DumpOutputField";
import { DumpSaveField } from "./DumpSaveField";

/** Dump dialog for a sidebar target or a saved dump; mount once at the app root. */
export function DumpDialog() {
  const target = useDumpDialog((state) => state.target);
  const profile = useDumpDialog((state) => state.profile);
  const close = useDumpDialog((state) => state.close);
  return (
    <Dialog
      open={target !== null}
      onOpenChange={(open) => {
        if (!open) close();
      }}
    >
      {/* Keyed so every opening starts from a fresh form. */}
      {target && (
        <DumpForm
          key={JSON.stringify([target, profile?.id])}
          target={target}
          profile={profile}
          onDone={close}
        />
      )}
    </Dialog>
  );
}

interface DumpFormProps {
  target: DumpTarget;
  profile: DumpProfile | null;
  onDone: () => void;
}

function DumpForm({ target, profile, onDone }: DumpFormProps) {
  const [values, setValues] = useState(() => initialDumpValues(target, profile ?? undefined));
  const [errors, setErrors] = useState<DumpFormErrors>({});
  const closing = useAfterDialogClose();
  const submitDump = useSubmitDump();
  const tools = useToolsInfo();
  const missing = tools.data?.tools.some((tool) => tool.tool === "mongodump" && !tool.version);
  const scope = dumpScope(target);
  const change = (patch: Partial<DumpFormValues>) => {
    setValues((current) => ({ ...current, ...patch }));
    setErrors({});
  };

  const browse = async () => {
    const picked =
      values.kind === "folder"
        ? await pickDumpFolder()
        : await pickArchivePath(defaultArchiveName(target, values.gzip));
    if (picked) change({ path: picked });
  };

  const submit = (run: boolean) => {
    const found = validateDumpForm(values);
    setErrors(found);
    if (Object.keys(found).length > 0) return;
    const name = values.name.trim();
    submitDump.mutate(
      {
        connectionId: target.connectionId,
        request: buildDumpRequest(target, values),
        profile: values.save ? { id: profile?.id ?? null, name } : null,
        run,
      },
      {
        onSuccess: (job) => {
          if (job) {
            closing.after(() => {
              useJobsPanel.getState().setOpen(true);
            });
          } else {
            toast.success(`Saved “${name}”.`);
            // Edited from the saved dumps list: go back to it.
            if (profile) {
              closing.after(() => {
                useSavedDumpsDialog.getState().setOpen(true);
              });
            }
          }
          onDone();
        },
      },
    );
  };

  return (
    <DialogContent
      className="flex max-h-[90vh] max-w-lg flex-col"
      onCloseAutoFocus={closing.onCloseAutoFocus}
    >
      <DialogHeader>
        <DialogTitle>{profile ? `Edit “${profile.name}”` : `Dump ${scope}`}</DialogTitle>
        <DialogDescription>
          Saves a copy of {target.database === null ? "every database" : scope} with mongodump. You
          can keep working while it runs.
        </DialogDescription>
      </DialogHeader>
      <form
        className="-mx-1 grid min-h-0 gap-4 overflow-auto px-1"
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          submit(true);
        }}
      >
        <DumpOutputField
          kind={values.kind}
          path={values.path}
          error={errors.path ?? null}
          onKindChange={(kind) => {
            change({ kind, path: "" });
          }}
          onPathChange={(path) => {
            change({ path });
          }}
          onBrowse={() => void browse()}
        />
        <DumpOptionsFields
          target={target}
          scope={dumpScopeKind(target)}
          values={values}
          parallelError={errors.parallel ?? null}
          onChange={change}
        />
        <DumpSaveField
          values={values}
          editing={profile !== null}
          error={errors.name ?? null}
          onChange={change}
        />
        {missing && (
          <InlineError
            error={{
              code: "NOT_FOUND",
              message: "mongodump is not included in this build of RipeMongo.",
              hint: "Reinstall RipeMongo. If you built it yourself, run `pnpm sidecars` first.",
            }}
          />
        )}
        {submitDump.error && <InlineError error={submitDump.error} />}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onDone}>
            Cancel
          </Button>
          {values.save && (
            <Button
              type="button"
              variant="outline"
              disabled={submitDump.isPending}
              onClick={() => {
                submit(false);
              }}
            >
              Save
            </Button>
          )}
          <Button type="submit" disabled={submitDump.isPending || missing === true}>
            {values.save ? "Save and start" : "Start dump"}
          </Button>
        </div>
      </form>
    </DialogContent>
  );
}
