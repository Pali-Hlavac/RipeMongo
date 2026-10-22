import { ListChecksIcon } from "lucide-react";
import { useState } from "react";

import { EmptyState } from "@/shared/components/EmptyState";
import { ErrorState } from "@/shared/components/ErrorState";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/shared/ui/dialog";

import { useJobs } from "../api/jobs";
import { useJobsPanel } from "../store/panel";
import { JobCard } from "./JobCard";
import { JobLogDialog } from "./JobLogDialog";

/** Every background job of this session; mount once at the app root. */
export function JobsPanel() {
  const open = useJobsPanel((state) => state.open);
  const setOpen = useJobsPanel((state) => state.setOpen);
  const { data: jobs, error, refetch } = useJobs();
  const [logJobId, setLogJobId] = useState<string | null>(null);
  const logJob = jobs?.find((job) => job.id === logJobId);

  return (
    <>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="flex max-h-[85vh] max-w-2xl flex-col">
          <DialogHeader>
            <DialogTitle>Background jobs</DialogTitle>
            <DialogDescription>
              Dumps and other long tasks keep running while you work. Close this window at any time.
            </DialogDescription>
          </DialogHeader>
          {error && (
            <ErrorState error={error} title="Could not load jobs" onRetry={() => void refetch()} />
          )}
          {jobs?.length === 0 && (
            <EmptyState
              icon={ListChecksIcon}
              title="No jobs yet"
              description="Dump a database from the ⋯ menu in the sidebar; its progress appears here."
            />
          )}
          {jobs && jobs.length > 0 && (
            <ul className="-mx-1 grid min-h-0 gap-2 overflow-auto px-1" aria-label="Jobs">
              {jobs.map((job) => (
                <JobCard
                  key={job.id}
                  job={job}
                  onShowLog={() => {
                    setLogJobId(job.id);
                  }}
                />
              ))}
            </ul>
          )}
        </DialogContent>
      </Dialog>
      {logJob && (
        <JobLogDialog
          job={logJob}
          onClose={() => {
            setLogJobId(null);
          }}
        />
      )}
    </>
  );
}
