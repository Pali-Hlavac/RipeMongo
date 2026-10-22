import { useId, type ReactElement, type ReactNode } from "react";

import { cn } from "@/shared/lib/cn";

interface ControlProps {
  id: string;
  "aria-describedby"?: string;
  "aria-invalid"?: boolean;
}

interface FormFieldProps {
  label: string;
  /** Help text shown under the control. */
  description?: ReactNode;
  /** Validation message; marks the control invalid. */
  error?: string | null;
  className?: string;
  /** Render prop receiving the accessibility attributes for the control. */
  children: (control: ControlProps) => ReactElement;
}

/** Label + control + description/error, wired together for screen readers. */
export function FormField({ label, description, error, className, children }: FormFieldProps) {
  const id = useId();
  const descriptionId = `${id}-description`;
  const hasNote = Boolean(error ?? description);
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <label htmlFor={id} className="text-sm font-medium">
        {label}
      </label>
      {children({
        id,
        "aria-describedby": hasNote ? descriptionId : undefined,
        "aria-invalid": error ? true : undefined,
      })}
      {hasNote && (
        <p
          id={descriptionId}
          className={cn("text-xs", error ? "text-destructive" : "text-muted-foreground")}
        >
          {error ?? description}
        </p>
      )}
    </div>
  );
}
