import { useRef, useState } from "react";

import { useToolsInfo } from "@/features/about";
import { useJobsPanel } from "@/features/jobs";
import { InlineError } from "@/shared/components/InlineError";
import { Button } from "@/shared/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/shared/ui/dialog";
import { Checkbox } from "@/shared/ui/input";

import { pickArchivePath, pickDumpFolder, useStartDump } from "../api/dump";
import { buildDumpRequest, defaultArchiveName, dumpScope, type DumpOutputKind } from "../lib/dump";
import { useDumpDialog, type DumpTarget } from "../store/dump";
import { DumpOutputField } from "./DumpOutputField";

/** Dump dialog for the target chosen in the sidebar; mount once at the app root. */
export function DumpDialog() {
  const target = useDumpDialog((state) => state.target);
  const close = useDumpDialog((state) => state.close);
  return (
    <Dialog
      open={target !== null}
      onOpenChange={(open) => {
        if (!open) close();
      }}
    >
      {/* Keyed so every opening starts from a fresh form. */}
      {target && <DumpForm key={JSON.stringify(target)} target={target} onDone={close} />}
    </Dialog>
  );
}

function DumpForm({ target, onDone }: { target: DumpTarget; onDone: () => void }) {
  const [kind, setKind] = useState<DumpOutputKind>("folder");
  const [path, setPath] = useState("");
  const [gzip, setGzip] = useState(false);
  const [pathError, setPathError] = useState<string | null>(null);
  const showJobs = useRef(false);
  const start = useStartDump();
  const tools = useToolsInfo();
  const missing = tools.data?.tools.some((tool) => tool.tool === "mongodump" && !tool.version);
  const scope = dumpScope(target);

  const browse = async () => {
    const picked =
      kind === "folder"
        ? await pickDumpFolder()
        : await pickArchivePath(defaultArchiveName(target, gzip));
    if (picked) {
      setPath(picked);
      setPathError(null);
    }
  };

  const submit = () => {
    if (path.trim() === "") {
      setPathError(kind === "folder" ? "Choose a folder." : "Choose a file.");
      return;
    }
    start.mutate(
      { connectionId: target.connectionId, request: buildDumpRequest(target, kind, path, gzip) },
      {
        onSuccess: () => {
          showJobs.current = true;
          onDone();
        },
      },
    );
  };

  return (
    <DialogContent
      className="max-w-lg"
      onCloseAutoFocus={(event) => {
        // Radix returns focus to the sidebar menu after closing; opening the jobs panel before
        // that would let the focus land outside it and close it again. Open it here instead.
        if (!showJobs.current) return;
        event.preventDefault();
        useJobsPanel.getState().setOpen(true);
      }}
    >
      <DialogHeader>
        <DialogTitle>Dump {scope}</DialogTitle>
        <DialogDescription>
          Saves a copy of {target.database === null ? "every database" : scope} with mongodump. You
          can keep working while it runs.
        </DialogDescription>
      </DialogHeader>
      <form
        className="grid gap-4"
        onSubmit={(event) => {
          event.preventDefault();
          submit();
        }}
      >
        <DumpOutputField
          kind={kind}
          path={path}
          error={pathError}
          onKindChange={(next) => {
            setKind(next);
            setPath("");
            setPathError(null);
          }}
          onPathChange={(next) => {
            setPath(next);
            setPathError(null);
          }}
          onBrowse={() => void browse()}
        />
        <Checkbox
          label="Compress with gzip"
          checked={gzip}
          onChange={(event) => {
            setGzip(event.target.checked);
          }}
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
        {start.error && <InlineError error={start.error} />}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onDone}>
            Cancel
          </Button>
          <Button type="submit" disabled={start.isPending || missing === true}>
            Start dump
          </Button>
        </div>
      </form>
    </DialogContent>
  );
}
