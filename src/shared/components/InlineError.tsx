import { AlertTriangleIcon } from "lucide-react";

import { toIpcError } from "@/shared/ipc/client";
import { cn } from "@/shared/lib/cn";

/** Compact error box for forms and dialogs: the message and, when known, what to do next. */
export function InlineError({ error, className }: { error: unknown; className?: string }) {
  const { message, hint } = toIpcError(error);
  return (
    <div
      role="alert"
      className={cn(
        "flex gap-2 rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm",
        className,
      )}
    >
      <AlertTriangleIcon className="mt-0.5 size-4 shrink-0 text-destructive" aria-hidden />
      <div className="grid gap-1">
        <p>{message}</p>
        {hint && <p className="text-muted-foreground">{hint}</p>}
      </div>
    </div>
  );
}
