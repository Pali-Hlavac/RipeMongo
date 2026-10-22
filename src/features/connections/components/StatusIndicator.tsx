import { LoaderCircleIcon } from "lucide-react";

import { cn } from "@/shared/lib/cn";

import { STATUS_LABELS, type ConnectionStatus } from "../store/status";

const DOT_CLASSES: Record<Exclude<ConnectionStatus, "connecting">, string> = {
  disconnected: "bg-transparent border border-muted-foreground/50",
  connected: "bg-primary",
  failed: "bg-destructive",
};

/** Small status dot (spinner while connecting) with an accessible label. */
export function StatusIndicator({ status }: { status: ConnectionStatus }) {
  const label = STATUS_LABELS[status];
  if (status === "connecting") {
    return (
      <LoaderCircleIcon className="size-3 animate-spin text-muted-foreground" aria-label={label} />
    );
  }
  return (
    <span
      role="img"
      aria-label={label}
      title={label}
      className={cn("inline-block size-2 shrink-0 rounded-full", DOT_CLASSES[status])}
    />
  );
}
