import type { ReactNode } from "react";

import { InlineError } from "@/shared/components/InlineError";
import { cn } from "@/shared/lib/cn";
import { Button } from "@/shared/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/shared/ui/dialog";

interface FormDialogProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description: ReactNode;
  submitLabel: string;
  canSubmit: boolean;
  pending: boolean;
  /** Error of the last submit, shown above the buttons. */
  error: unknown;
  onSubmit: () => void;
  className?: string;
  children: ReactNode;
}

/** Modal form with inline submit errors (create/rename dialogs, saving favorites); Enter submits. */
export function FormDialog({
  open,
  onClose,
  title,
  description,
  submitLabel,
  canSubmit,
  pending,
  error,
  onSubmit,
  className,
  children,
}: FormDialogProps) {
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
    >
      <DialogContent className={cn("max-w-md", className)}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <form
          className="grid gap-4"
          noValidate
          onSubmit={(event) => {
            event.preventDefault();
            if (canSubmit && !pending) onSubmit();
          }}
        >
          {children}
          {error ? <InlineError error={error} /> : null}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={!canSubmit || pending}>
              {submitLabel}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
