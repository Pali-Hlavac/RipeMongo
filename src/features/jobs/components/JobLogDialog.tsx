import { CopyIcon } from "lucide-react";
import { useEffect, useRef } from "react";

import { ErrorState } from "@/shared/components/ErrorState";
import { LoadingState } from "@/shared/components/LoadingState";
import type { JobInfo } from "@/shared/ipc/bindings";
import { copyText } from "@/shared/lib/clipboard";
import { Button } from "@/shared/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/shared/ui/dialog";

import { useJobLog } from "../api/jobs";

/** The equivalent command (copyable) and the full tool output of a job. */
export function JobLogDialog({ job, onClose }: { job: JobInfo; onClose: () => void }) {
  const log = useJobLog(job.id);
  const end = useRef<HTMLDivElement>(null);
  const lines = log.data?.length ?? 0;

  // Follow new output like a terminal.
  useEffect(() => {
    end.current?.scrollIntoView({ block: "end" });
  }, [lines]);

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent className="flex max-h-[85vh] max-w-3xl flex-col">
        <DialogHeader>
          <DialogTitle>{job.title}</DialogTitle>
          <DialogDescription>
            The command RipeMongo ran and everything the tool printed.
          </DialogDescription>
        </DialogHeader>
        {job.command && (
          <section className="grid gap-1.5" aria-label="Equivalent command">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium">Equivalent command</h3>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => void copyText(job.command ?? "", "Command")}
              >
                <CopyIcon aria-hidden /> Copy
              </Button>
            </div>
            <code className="rounded-md bg-muted p-2 font-mono text-xs break-all">
              {job.command}
            </code>
            <p className="text-xs text-muted-foreground">
              Passwords are left out. RipeMongo passes them to the tool in a temporary file, never
              on the command line.
            </p>
          </section>
        )}
        <section className="flex min-h-0 flex-1 flex-col gap-1.5" aria-label="Log">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium">Log</h3>
            <Button
              variant="ghost"
              size="sm"
              disabled={!log.data?.length}
              onClick={() => void copyText((log.data ?? []).join("\n"), "Log")}
            >
              <CopyIcon aria-hidden /> Copy log
            </Button>
          </div>
          {log.isPending && <LoadingState label="Loading the log…" />}
          {log.error && <ErrorState error={log.error} title="Could not load the log" />}
          {log.data && (
            <div className="min-h-40 flex-1 overflow-auto rounded-md border border-border bg-muted/40 p-2">
              <pre className="font-mono text-xs whitespace-pre-wrap">
                {log.data.length > 0 ? log.data.join("\n") : "No output yet."}
              </pre>
              <div ref={end} />
            </div>
          )}
        </section>
      </DialogContent>
    </Dialog>
  );
}
