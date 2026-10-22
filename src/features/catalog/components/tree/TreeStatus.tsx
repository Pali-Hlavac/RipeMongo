import { AlertTriangleIcon, LoaderCircleIcon } from "lucide-react";

import { toIpcError } from "@/shared/ipc/client";
import { cn } from "@/shared/lib/cn";

import { DEPTH_PADDING } from "./depth";

interface TreeStatusProps {
  depth: 1 | 2;
  pending: boolean;
  error: unknown;
  loadingLabel: string;
  onRetry: () => void;
}

/** Compact loading or error line inside the tree; renders nothing once data is there. */
export function TreeStatus({ depth, pending, error, loadingLabel, onRetry }: TreeStatusProps) {
  const className = cn(
    "flex items-center gap-1.5 py-1 pr-2 text-xs text-muted-foreground",
    DEPTH_PADDING[depth],
  );
  if (error) {
    const { message, hint } = toIpcError(error);
    return (
      <div role="alert" className={className} title={hint ?? undefined}>
        <AlertTriangleIcon className="size-3.5 shrink-0 text-destructive" aria-hidden />
        <span className="min-w-0 flex-1 truncate">{message}</span>
        <button
          type="button"
          className="shrink-0 rounded-sm px-1 underline outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
          onClick={onRetry}
        >
          Retry
        </button>
      </div>
    );
  }
  if (!pending) return null;
  return (
    <div role="status" className={className}>
      <LoaderCircleIcon className="size-3.5 animate-spin" aria-hidden />
      {loadingLabel}
    </div>
  );
}
