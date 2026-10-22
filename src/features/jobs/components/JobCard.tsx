import {
  CheckCircle2Icon,
  CircleSlashIcon,
  LoaderCircleIcon,
  ScrollTextIcon,
  SquareIcon,
  XCircleIcon,
  XIcon,
  type LucideIcon,
} from "lucide-react";

import { InlineError } from "@/shared/components/InlineError";
import type { JobInfo, JobStatus } from "@/shared/ipc/bindings";
import { cn } from "@/shared/lib/cn";
import { Button } from "@/shared/ui/button";

import { useCancelJob, useDismissJob } from "../api/jobs";
import { isRunning, STATUS_LABELS } from "../lib/jobs";
import { JobProgressBar } from "./JobProgressBar";

const STATUS_ICONS: Record<JobStatus, LucideIcon> = {
  running: LoaderCircleIcon,
  succeeded: CheckCircle2Icon,
  failed: XCircleIcon,
  cancelled: CircleSlashIcon,
};

const STATUS_COLORS: Record<JobStatus, string> = {
  running: "animate-spin text-muted-foreground",
  succeeded: "text-primary",
  failed: "text-destructive",
  cancelled: "text-muted-foreground",
};

const time = new Intl.DateTimeFormat(undefined, { hour: "2-digit", minute: "2-digit" });

interface JobCardProps {
  job: JobInfo;
  onShowLog: () => void;
}

/** One job: status, progress or result, and its actions. */
export function JobCard({ job, onShowLog }: JobCardProps) {
  const cancel = useCancelJob();
  const dismiss = useDismissJob();
  const Icon = STATUS_ICONS[job.status];
  const running = isRunning(job);

  return (
    <li className="grid gap-2 rounded-md border border-border p-3">
      <div className="flex items-center gap-2">
        <Icon className={cn("size-4 shrink-0", STATUS_COLORS[job.status])} aria-hidden />
        <span className="min-w-0 flex-1 truncate text-sm font-medium" title={job.title}>
          {job.title}
        </span>
        <span className="shrink-0 text-xs text-muted-foreground">
          {STATUS_LABELS[job.status]} · {time.format(job.finishedAt ?? job.startedAt ?? undefined)}
        </span>
      </div>
      {running && <JobProgressBar progress={job.progress} label={`Progress of ${job.title}`} />}
      {job.status === "succeeded" && job.summary && (
        <p className="text-sm text-muted-foreground">{job.summary}</p>
      )}
      {job.error && <InlineError error={job.error} />}
      {cancel.error && <InlineError error={cancel.error} />}
      <div className="flex justify-end gap-1">
        <Button variant="ghost" size="sm" onClick={onShowLog}>
          <ScrollTextIcon aria-hidden /> Details and log
        </Button>
        {running ? (
          <Button
            variant="outline"
            size="sm"
            disabled={cancel.isPending}
            onClick={() => {
              cancel.mutate(job.id);
            }}
          >
            <SquareIcon aria-hidden /> Cancel
          </Button>
        ) : (
          <Button
            variant="ghost"
            size="sm"
            aria-label={`Remove ${job.title} from the list`}
            onClick={() => {
              dismiss.mutate(job.id);
            }}
          >
            <XIcon aria-hidden /> Remove
          </Button>
        )}
      </div>
    </li>
  );
}
