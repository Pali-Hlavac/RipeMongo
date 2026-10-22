import { ChevronDownIcon, PencilLineIcon, Trash2Icon } from "lucide-react";
import { useState } from "react";

import { Button } from "@/shared/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/shared/ui/dropdown-menu";

import type { CollectionTarget } from "../../api/keys";
import { BulkDeleteDialog } from "./BulkDeleteDialog";
import { BulkUpdateDialog } from "./BulkUpdateDialog";

interface BulkActionsMenuProps {
  target: CollectionTarget;
  /** The tab's applied filter; the dialogs start from it. */
  filter: string;
}

/** "Bulk" menu: update or delete every document matching a filter. */
export function BulkActionsMenu({ target, filter }: BulkActionsMenuProps) {
  const [open, setOpen] = useState<"update" | "delete" | null>(null);
  const close = () => {
    setOpen(null);
  };
  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" className="h-7">
            Bulk <ChevronDownIcon aria-hidden />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          <DropdownMenuItem
            onSelect={() => {
              setOpen("update");
            }}
          >
            <PencilLineIcon aria-hidden /> Update documents…
          </DropdownMenuItem>
          <DropdownMenuItem
            destructive
            onSelect={() => {
              setOpen("delete");
            }}
          >
            <Trash2Icon aria-hidden /> Delete documents…
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      {open === "update" && (
        <BulkUpdateDialog target={target} initialFilter={filter} onClose={close} />
      )}
      {open === "delete" && (
        <BulkDeleteDialog target={target} initialFilter={filter} onClose={close} />
      )}
    </>
  );
}
