import { useState } from "react";

import { ConfirmByTypingDialog } from "@/shared/components/ConfirmByTypingDialog";
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

import { useUpdateMany, useUpdatePreview, type BulkInput } from "../../api/bulk";
import type { CollectionTarget } from "../../api/keys";
import { documentsPhrase, hasMatches, isAbout, UPDATE_TEMPLATE } from "../../lib/bulk";
import { BulkFilterField } from "./BulkFilterField";
import { PreviewSamples } from "./PreviewSamples";

interface BulkUpdateDialogProps {
  target: CollectionTarget;
  /** The tab's applied filter, as a starting point. */
  initialFilter: string;
  onClose: () => void;
}

/** Update every matching document: edit, preview, then confirm by typing the collection. */
export function BulkUpdateDialog({ target, initialFilter, onClose }: BulkUpdateDialogProps) {
  const [filter, setFilter] = useState(initialFilter);
  const [update, setUpdate] = useState(UPDATE_TEMPLATE);
  const [previewed, setPreviewed] = useState<BulkInput | null>(null);
  const [confirming, setConfirming] = useState(false);
  const preview = useUpdatePreview(target, previewed);
  const apply = useUpdateMany(target);

  const message = preview.error ? toIpcError(preview.error).message : "";
  const current = previewed?.filter === filter && previewed.update === update;
  const ready = current && preview.data !== undefined && hasMatches(preview.data.matched);
  const runPreview = () => {
    if (current) void preview.refetch();
    else setPreviewed({ filter, update });
  };

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent className="flex max-h-[90vh] max-w-4xl flex-col">
        <DialogHeader>
          <DialogTitle>Update documents</DialogTitle>
          <DialogDescription>
            Changes every document in {target.collection} that matches the filter. Use update
            operators such as $set and $unset, or a pipeline in [ ].
          </DialogDescription>
        </DialogHeader>
        <BulkFilterField
          value={filter}
          onChange={setFilter}
          onSubmit={runPreview}
          invalid={isAbout(message, "Filter")}
        />
        <div className="grid gap-1.5">
          <span className="text-sm font-medium">Update</span>
          <LazyCodeEditor
            value={UPDATE_TEMPLATE}
            onChange={setUpdate}
            onSubmit={runPreview}
            error={isAbout(message, "Update") ? editorErrorFrom(message) : null}
            ariaLabel="Update"
            className="h-40 rounded-md border border-border"
          />
        </div>
        {preview.error ? <InlineError error={preview.error} /> : null}
        <div className="min-h-0 flex-1 overflow-auto">
          {preview.data && (
            <PreviewSamples
              matched={preview.data.matched}
              samples={preview.data.samples}
              simulated={preview.data.simulated}
              stale={!current}
            />
          )}
        </div>
        <div className="flex items-center justify-end gap-2">
          <span className="mr-auto text-xs text-muted-foreground">
            <Kbd combo="mod+enter" /> to preview
          </span>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="outline" disabled={preview.isFetching} onClick={runPreview}>
            Preview
          </Button>
          <Button
            disabled={!ready}
            onClick={() => {
              setConfirming(true);
            }}
          >
            Update {preview.data && current ? documentsPhrase(preview.data.matched) : "documents"}
          </Button>
        </div>
        {preview.data && (
          <ConfirmByTypingDialog
            open={confirming}
            onOpenChange={(open) => {
              if (!open) apply.reset();
              setConfirming(open);
            }}
            title={`Update ${documentsPhrase(preview.data.matched)}?`}
            description="The update is applied to every document that matches the filter now. It cannot be undone."
            confirmText={target.collection}
            confirmLabel="Update documents"
            pending={apply.isPending}
            error={apply.error}
            onConfirm={() => {
              apply.mutate({ filter, update }, { onSuccess: onClose });
            }}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
