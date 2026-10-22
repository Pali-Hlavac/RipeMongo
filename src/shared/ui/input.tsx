import type { ComponentProps } from "react";

import { cn } from "@/shared/lib/cn";

/** Shared input styles, reused by textareas and native selects. */
export const fieldClassName =
  "w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 aria-[invalid=true]:border-destructive";

/** Single-line text input. */
export function Input({ className, ...props }: ComponentProps<"input">) {
  return <input className={cn(fieldClassName, "h-9", className)} {...props} />;
}

/** Multi-line text input. */
export function Textarea({ className, ...props }: ComponentProps<"textarea">) {
  return <textarea className={cn(fieldClassName, "min-h-16 font-mono", className)} {...props} />;
}

/** Native `<select>`: accessible and keyboard friendly out of the box. */
export function NativeSelect({ className, ...props }: ComponentProps<"select">) {
  return <select className={cn(fieldClassName, "h-9 pr-8", className)} {...props} />;
}

/** Checkbox with an inline label. */
export function Checkbox({
  label,
  className,
  ...props
}: Omit<ComponentProps<"input">, "type"> & { label: string }) {
  return (
    <label className={cn("inline-flex items-center gap-2 text-sm", className)}>
      <input type="checkbox" className="size-4 accent-primary" {...props} />
      {label}
    </label>
  );
}
