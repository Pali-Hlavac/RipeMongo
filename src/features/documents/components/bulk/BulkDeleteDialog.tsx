import { useState } from "react";

import { ConfirmByTypingDialog } from "@/shared/components/ConfirmByTypingDialog";
import { InlineError } from "@/shared/components/InlineError";
import { LoadingState } from "@/shared/components/LoadingState";
import { toIpcError } from "@/shared/ipc/client";
import { Button } from "@/shared/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/shared/ui/dialog";

import { useDeleteMany, useDeletePreview } from "../../api/bulk";
import type { CollectionTarget } from "../../api/keys";
import { documentsPhrase, hasMatches, isAbout } from "../../lib/bulk";
import { BulkFilterField } from "./BulkFilterField";
import { PreviewSamples } from "./PreviewSamples";

interface BulkDeleteDialogProps {
  target: CollectionTarget;
  /** The tab's applied filter; previewed as soon as the dialog opens. */
  initialFilter: string;
  onClose: () => void;
}

/** Delete every matching document: preview, then confirm by typing the collection. */
export function BulkDeleteDialog({ target, initialFilter, onClose }: BulkDeleteDialogProps) {
  const [filter, setFilter] = useState(initialFilter);
  const [previewed, setPreviewed] = useState(initialFilter);
  const [confirming, setConfirming] = useState(false);
  const preview = useDeletePreview(target, previewed);
  const remove = useDeleteMany(target);

  const message = preview.error ? toIpcError(preview.error).message : "";
  const current = previewed === filter;
  const ready = current && preview.data !== undefined && hasMatches(preview.data.matched);
  const runPreview = () => {
    if (filter === previewed) void preview.refetch();
    else setPreviewed(filter);
  };

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent className="flex max-h-[90vh] max-w-3xl flex-col">
        <DialogHeader>
          <DialogTitle>Delete documents</DialogTitle>
          <DialogDescription>
            Deletes every document in {target.collection} that matches the filter. An empty filter
            deletes all documents.
          </DialogDescription>
        </DialogHeader>
        <BulkFilterField
          value={filter}
          onChange={setFilter}
          onSubmit={runPreview}
          invalid={isAbout(message, "Filter")}
        />
        {preview.error ? <InlineError error={preview.error} /> : null}
        <div className="min-h-0 flex-1 overflow-auto">
          {preview.isPending && <LoadingState label="Counting documents…" />}
          {preview.data && (
            <PreviewSamples
              matched={preview.data.matched}
              samples={preview.data.samples.map((before) => ({ before, after: null }))}
              stale={!current}
            />
          )}
        </div>
        <div className="flex items-center justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="outline" disabled={preview.isFetching} onClick={runPreview}>
            Preview
          </Button>
          <Button
            variant="destructive"
            disabled={!ready}
            onClick={() => {
              setConfirming(true);
            }}
          >
            Delete {preview.data && current ? documentsPhrase(preview.data.matched) : "documents"}
          </Button>
        </div>
        {preview.data && (
          <ConfirmByTypingDialog
            open={confirming}
            onOpenChange={(open) => {
              if (!open) remove.reset();
              setConfirming(open);
            }}
            title={`Delete ${documentsPhrase(preview.data.matched)}?`}
            description="Every document that matches the filter now is deleted permanently. This cannot be undone."
            confirmText={target.collection}
            confirmLabel="Delete documents"
            pending={remove.isPending}
            error={remove.error}
            onConfirm={() => {
              remove.mutate(filter, { onSuccess: onClose });
            }}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
