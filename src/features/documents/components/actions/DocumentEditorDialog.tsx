import { useState } from "react";

import { InlineError } from "@/shared/components/InlineError";
import { LazyCodeEditor } from "@/shared/editor/LazyCodeEditor";
import { editorErrorFrom } from "@/shared/editor/types";
import { toIpcError } from "@/shared/ipc/client";
import { Button } from "@/shared/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/shared/ui/dialog";
import { Kbd } from "@/shared/ui/kbd";

export interface EditorDialogProps {
  title: string;
  description: string;
  submitLabel: string;
  initialText: string;
  pending: boolean;
  error: unknown;
  onSubmit: (text: string) => void;
  onClose: () => void;
}

/** Large dialog with the code editor; Ctrl/⌘+Enter submits. Parse errors are marked inline. */
export function DocumentEditorDialog({
  title,
  description,
  submitLabel,
  initialText,
  pending,
  error,
  onSubmit,
  onClose,
}: EditorDialogProps) {
  const [text, setText] = useState(initialText);
  const editorError = error ? editorErrorFrom(toIpcError(error).message) : null;
  const submit = () => {
    if (!pending) onSubmit(text);
  };

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent className="flex h-[80vh] max-w-4xl flex-col">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <LazyCodeEditor
          value={initialText}
          onChange={setText}
          onSubmit={submit}
          error={editorError}
          ariaLabel={title}
          className="min-h-0 flex-1 rounded-md border border-border"
        />
        {error ? <InlineError error={error} /> : null}
        <div className="flex items-center justify-end gap-2">
          <span className="mr-auto text-xs text-muted-foreground">
            <Kbd combo="mod+enter" /> to save
          </span>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button disabled={pending} onClick={submit}>
            {submitLabel}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
