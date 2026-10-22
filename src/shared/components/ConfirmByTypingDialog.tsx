import { useId, useState, type ReactNode } from "react";

import { Button } from "@/shared/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/shared/ui/dialog";
import { Input } from "@/shared/ui/input";

import { InlineError } from "./InlineError";

interface ConfirmByTypingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: ReactNode;
  /** The exact text the user must type, usually the name of what gets destroyed. */
  confirmText: string;
  confirmLabel: string;
  pending?: boolean;
  /** Error of the last attempt, shown above the buttons. */
  error?: unknown;
  onConfirm: () => void;
}

/**
 * Confirmation for destructive, irreversible actions (drop, bulk delete, restore with drop):
 * the confirm button stays disabled until the user types `confirmText` exactly.
 */
export function ConfirmByTypingDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmText,
  confirmLabel,
  pending = false,
  error = null,
  onConfirm,
}: ConfirmByTypingDialogProps) {
  const [typed, setTyped] = useState("");
  // Forget the typed text whenever the dialog closes, however it was closed.
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (!open) setTyped("");
  }
  const inputId = useId();
  const matches = typed === confirmText;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <form
          className="grid gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            if (matches) onConfirm();
          }}
        >
          <div className="grid gap-1.5">
            <label htmlFor={inputId} className="text-sm">
              Type <strong className="font-mono select-text">{confirmText}</strong> to confirm.
            </label>
            <Input
              id={inputId}
              autoComplete="off"
              spellCheck={false}
              value={typed}
              onChange={(event) => {
                setTyped(event.target.value);
              }}
            />
          </div>
          {error ? <InlineError error={error} /> : null}
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                onOpenChange(false);
              }}
            >
              Cancel
            </Button>
            <Button type="submit" variant="destructive" disabled={!matches || pending}>
              {confirmLabel}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
