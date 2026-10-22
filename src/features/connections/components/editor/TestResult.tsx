import { CheckCircle2Icon, XCircleIcon } from "lucide-react";

import type { ServerInfo } from "@/shared/ipc/bindings";
import { toIpcError } from "@/shared/ipc/client";

import { ServerSummary } from "../ServerSummary";

interface TestResultProps {
  server: ServerInfo | undefined;
  error: unknown;
}

/** Inline outcome of "Test connection". */
export function TestResult({ server, error }: TestResultProps) {
  if (server) {
    return (
      <div role="status" className="grid gap-2 rounded-md border border-border bg-muted/40 p-3">
        <p className="flex items-center gap-2 text-sm font-medium text-primary">
          <CheckCircle2Icon className="size-4" aria-hidden />
          Connected successfully
        </p>
        <ServerSummary server={server} />
      </div>
    );
  }
  if (error) {
    const { message, hint } = toIpcError(error);
    return (
      <div role="alert" className="grid gap-1 rounded-md border border-destructive/40 p-3 text-sm">
        <p className="flex items-center gap-2 font-medium text-destructive">
          <XCircleIcon className="size-4" aria-hidden />
          {message}
        </p>
        {hint && <p className="text-muted-foreground">{hint}</p>}
      </div>
    );
  }
  return null;
}
