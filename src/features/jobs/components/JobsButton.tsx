import { ListChecksIcon, LoaderCircleIcon } from "lucide-react";

import { Button } from "@/shared/ui/button";

import { useJobs } from "../api/jobs";
import { isRunning } from "../lib/jobs";
import { useJobsPanel } from "../store/panel";

/** Status-bar entry to the jobs panel; spins while jobs run. */
export function JobsButton() {
  const { data: jobs } = useJobs();
  const running = jobs?.filter(isRunning).length ?? 0;
  const label = running > 0 ? `${running} running` : "Jobs";
  return (
    <Button
      variant="ghost"
      size="sm"
      className="h-6 gap-1.5 px-2 text-xs"
      aria-label={running > 0 ? `Background jobs, ${running} running` : "Background jobs"}
      onClick={() => {
        useJobsPanel.getState().setOpen(true);
      }}
    >
      {running > 0 ? (
        <LoaderCircleIcon className="animate-spin" aria-hidden />
      ) : (
        <ListChecksIcon aria-hidden />
      )}
      {label}
    </Button>
  );
}
