import { Trash2Icon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { FormDialog } from "@/shared/components/FormDialog";
import { Button } from "@/shared/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/shared/ui/dialog";
import { FormField } from "@/shared/ui/form-field";
import { Input } from "@/shared/ui/input";

import { useDeleteFavorite, useSaveFavorite } from "../../api/history";
import type { CollectionTarget } from "../../api/keys";
import { describeQuery, queryParts } from "../../lib/query";
import type { QueryParts, SavedQuery } from "../../types";

interface SaveFavoriteDialogProps {
  open: boolean;
  onClose: () => void;
  target: CollectionTarget;
  query: QueryParts;
}

/** Names the query currently in the bar and saves it as a favorite of this collection. */
export function SaveFavoriteDialog({ open, ...props }: SaveFavoriteDialogProps) {
  // The form unmounts on close, so every opening starts empty.
  return open && <SaveFavoriteForm {...props} />;
}

function SaveFavoriteForm({ onClose, target, query }: Omit<SaveFavoriteDialogProps, "open">) {
  const save = useSaveFavorite(target);
  const [name, setName] = useState("");
  const parts = queryParts(query);

  return (
    <FormDialog
      open
      onClose={onClose}
      title="Save as favorite"
      description={<span className="font-mono break-all">{describeQuery(parts)}</span>}
      submitLabel="Save favorite"
      canSubmit={name.trim() !== ""}
      pending={save.isPending}
      error={save.error}
      onSubmit={() => {
        save.mutate(
          { name, query: parts },
          {
            onSuccess: () => {
              toast.success(`Saved favorite "${name.trim()}"`);
              onClose();
            },
          },
        );
      }}
    >
      <FormField label="Name" description="A favorite with the same name is replaced.">
        {(control) => (
          <Input
            {...control}
            autoComplete="off"
            value={name}
            onChange={(event) => {
              setName(event.target.value);
            }}
          />
        )}
      </FormField>
    </FormDialog>
  );
}

interface FavoritesDialogProps {
  open: boolean;
  onClose: () => void;
  target: CollectionTarget;
  favorites: SavedQuery[];
}

/** Lists the favorites of this collection with a delete button each. */
export function FavoritesDialog({ open, onClose, target, favorites }: FavoritesDialogProps) {
  const remove = useDeleteFavorite(target);
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
    >
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Favorite queries</DialogTitle>
          <DialogDescription>Saved for this collection on this computer.</DialogDescription>
        </DialogHeader>
        {favorites.length === 0 ? (
          <p className="text-sm text-muted-foreground">No favorites yet.</p>
        ) : (
          <ul className="grid max-h-80 gap-1 overflow-y-auto">
            {favorites.map((saved) => (
              <li
                key={saved.id}
                className="flex items-center gap-2 rounded-md border border-border p-2"
              >
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate text-sm font-medium">{saved.name}</span>
                  <span className="truncate font-mono text-xs text-muted-foreground">
                    {describeQuery(saved.query)}
                  </span>
                </span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-7"
                  aria-label={`Delete favorite ${saved.name ?? ""}`}
                  disabled={remove.isPending}
                  onClick={() => {
                    remove.mutate(saved.id);
                  }}
                >
                  <Trash2Icon aria-hidden />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </DialogContent>
    </Dialog>
  );
}
