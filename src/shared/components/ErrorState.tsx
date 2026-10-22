import { AlertTriangleIcon } from "lucide-react";

import { toIpcError } from "@/shared/ipc/client";
import { cn } from "@/shared/lib/cn";
import { Button } from "@/shared/ui/button";

interface ErrorStateProps {
  /** Anything thrown by a query or mutation; normalized via `toIpcError`. */
  error: unknown;
  /** Short context such as "Could not load settings". */
  title: string;
  onRetry?: () => void;
  className?: string;
}

/** Explains what failed and what the user can do next. */
export function ErrorState({ error, title, onRetry, className }: ErrorStateProps) {
  const { message, hint } = toIpcError(error);
  return (
    <div
      role="alert"
      className={cn("flex flex-col items-center gap-3 p-6 text-center text-sm", className)}
    >
      <AlertTriangleIcon className="size-8 text-destructive" aria-hidden />
      <p className="font-medium">{title}</p>
      <p className="max-w-sm text-muted-foreground">{message}</p>
      {hint && <p className="max-w-sm text-muted-foreground">{hint}</p>}
      {onRetry && (
        <Button variant="outline" size="sm" onClick={onRetry}>
          Try again
        </Button>
      )}
    </div>
  );
}
