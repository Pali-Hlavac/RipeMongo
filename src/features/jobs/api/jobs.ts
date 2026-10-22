/** Background jobs: list, log, cancel, dismiss. Job events patch these caches (useJobEvents). */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import type { JobInfo } from "@/shared/ipc/bindings";
import { call, commands, unwrap } from "@/shared/ipc/client";

export const jobKeys = {
  all: ["jobs"] as const,
  list: () => [...jobKeys.all, "list"] as const,
  log: (jobId: string) => [...jobKeys.all, "log", jobId] as const,
};

/** Every job of this session, newest first; kept current by events, never refetched. */
export function useJobs() {
  return useQuery({
    queryKey: jobKeys.list(),
    queryFn: () => call(commands.listJobs()),
    staleTime: Infinity,
  });
}

/** The log of one job; new lines are appended by events. */
export function useJobLog(jobId: string) {
  return useQuery({
    queryKey: jobKeys.log(jobId),
    queryFn: () => unwrap(commands.getJobLog(jobId)),
    staleTime: Infinity,
  });
}

export function useCancelJob() {
  return useMutation({ mutationFn: (jobId: string) => unwrap(commands.cancelJob(jobId)) });
}

export function useDismissJob() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (jobId: string) => unwrap(commands.dismissJob(jobId)),
    onSuccess: (_, jobId) => {
      queryClient.setQueryData<JobInfo[]>(jobKeys.list(), (jobs) =>
        jobs?.filter((job) => job.id !== jobId),
      );
      queryClient.removeQueries({ queryKey: jobKeys.log(jobId) });
    },
  });
}
