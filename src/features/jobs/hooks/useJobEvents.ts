/** Subscribes once to job events and patches the job caches; notifies when a job ends. */
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import { toast } from "sonner";

import { events, type JobInfo } from "@/shared/ipc/bindings";

import { jobKeys } from "../api/jobs";
import { appendLog, upsertJob } from "../lib/jobs";
import { useJobsPanel } from "../store/panel";

function showJobs() {
  useJobsPanel.getState().setOpen(true);
}

function notifyFinished(job: JobInfo) {
  const action = { label: "Show", onClick: showJobs };
  if (job.status === "succeeded") {
    toast.success(`${job.title}: done`, { description: job.summary ?? undefined, action });
  } else if (job.status === "failed") {
    toast.error(`${job.title}: failed`, { description: job.error?.message, action });
  } else {
    toast(`${job.title}: cancelled`, { action });
  }
}

/**
 * Mount once at the app root. `onFinished` runs when a job ends (succeeded, failed or
 * cancelled), for example to refresh data the job changed.
 */
export function useJobEvents(onFinished?: (job: JobInfo) => void) {
  const queryClient = useQueryClient();
  const finished = useRef(onFinished);
  useEffect(() => {
    finished.current = onFinished;
  }, [onFinished]);

  useEffect(() => {
    let disposed = false;
    const unlisteners: (() => void)[] = [];
    const keep = (unlisten: () => void) => {
      if (disposed) unlisten();
      else unlisteners.push(unlisten);
    };

    void events.jobUpdated
      .listen(({ payload: { job } }) => {
        const previous = queryClient
          .getQueryData<JobInfo[]>(jobKeys.list())
          ?.find((existing) => existing.id === job.id);
        queryClient.setQueryData<JobInfo[]>(jobKeys.list(), (jobs) => upsertJob(jobs, job));
        if (previous?.status === "running" && job.status !== "running") {
          notifyFinished(job);
          finished.current?.(job);
          // Lines published just before a log fetch could be missing; refetch the final log.
          void queryClient.invalidateQueries({ queryKey: jobKeys.log(job.id) });
        }
      })
      .then(keep);

    void events.jobLogged
      .listen(({ payload }) => {
        queryClient.setQueryData<string[]>(jobKeys.log(payload.jobId), (log) =>
          log === undefined ? undefined : appendLog(log, payload.lines),
        );
      })
      .then(keep);

    return () => {
      disposed = true;
      for (const unlisten of unlisteners) unlisten();
    };
  }, [queryClient]);
}
