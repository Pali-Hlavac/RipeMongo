import { LoaderCircleIcon } from "lucide-react";

import { cn } from "@/shared/lib/cn";

/** Spinner with an accessible label announced to screen readers. */
export function LoadingState({ label, className }: { label: string; className?: string }) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        "flex items-center justify-center gap-2 p-6 text-sm text-muted-foreground",
        className,
      )}
    >
      <LoaderCircleIcon className="size-4 animate-spin" aria-hidden />
      <span>{label}</span>
    </div>
  );
}
