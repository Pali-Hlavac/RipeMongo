import type { JobProgress } from "@/shared/ipc/bindings";
import { cn } from "@/shared/lib/cn";

import { progressPercent, progressText } from "../lib/jobs";

/** Determinate bar with "x of y" text, or a pulsing bar while the total is unknown. */
export function JobProgressBar({
  progress,
  label,
}: {
  progress: JobProgress | null;
  label: string;
}) {
  const percent = progress ? progressPercent(progress) : null;
  const text = progress ? progressText(progress) : "Starting…";
  return (
    <div className="grid gap-1">
      <div
        role="progressbar"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent === null ? undefined : Math.round(percent)}
        aria-valuetext={text}
        className="h-1.5 overflow-hidden rounded-full bg-muted"
      >
        <div
          className={cn(
            "h-full rounded-full bg-primary transition-[width]",
            percent === null && "w-1/3 animate-pulse",
          )}
          style={percent === null ? undefined : { width: `${percent}%` }}
        />
      </div>
      <p className="flex justify-between gap-2 text-xs text-muted-foreground">
        <span className="truncate">{progress?.message ?? ""}</span>
        <span className="shrink-0 tabular-nums">
          {text}
          {percent !== null && ` (${Math.floor(percent)}%)`}
        </span>
      </p>
    </div>
  );
}
