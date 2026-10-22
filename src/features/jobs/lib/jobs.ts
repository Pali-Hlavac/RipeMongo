import type { JobInfo, JobProgress, JobStatus } from "@/shared/ipc/bindings";
import { formatBytes, formatCount } from "@/shared/lib/format";

/** The backend keeps at most this many log lines per job; the cache mirrors it. */
export const MAX_LOG_LINES = 10_000;

export const STATUS_LABELS: Record<JobStatus, string> = {
  running: "Running",
  succeeded: "Done",
  failed: "Failed",
  cancelled: "Cancelled",
};

/** Replaces the job with the same id, or adds it; newest first. */
export function upsertJob(jobs: JobInfo[] | undefined, job: JobInfo): JobInfo[] {
  const others = (jobs ?? []).filter((existing) => existing.id !== job.id);
  return [job, ...others].sort((a, b) => (b.startedAt ?? 0) - (a.startedAt ?? 0));
}

/** Appends new lines to a cached log, keeping the newest {@link MAX_LOG_LINES}. */
export function appendLog(log: string[], lines: string[]): string[] {
  const combined = [...log, ...lines];
  return combined.length > MAX_LOG_LINES ? combined.slice(-MAX_LOG_LINES) : combined;
}

/** 0–100, or `null` while the total is unknown (indeterminate). */
export function progressPercent(progress: JobProgress): number | null {
  if (progress.total === null || progress.total <= 0) return null;
  return Math.min(100, ((progress.done ?? 0) / progress.total) * 100);
}

/** "120 of 1,500 documents", "3 MB of 12 MB", "120 documents". */
export function progressText(progress: JobProgress): string {
  // Numbers from Rust are typed nullable (NaN would serialize as null).
  const count = progress.done ?? 0;
  if (progress.unit === "bytes") {
    const done = formatBytes(count);
    return progress.total === null ? done : `${done} of ${formatBytes(progress.total)}`;
  }
  const noun = count === 1 && progress.total === null ? "document" : "documents";
  const done = formatCount(count);
  return progress.total === null
    ? `${done} ${noun}`
    : `${done} of ${formatCount(progress.total)} ${noun}`;
}

export function isRunning(job: JobInfo): boolean {
  return job.status === "running";
}
