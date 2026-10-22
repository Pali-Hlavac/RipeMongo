import { MoreHorizontalIcon } from "lucide-react";
import type { ReactNode } from "react";

import { Button } from "@/shared/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from "@/shared/ui/dropdown-menu";

/** "⋯" button of a tree row; visible on hover, focus or while open. */
export function RowMenu({ label, children }: { label: string; children: ReactNode }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="size-6 opacity-0 group-focus-within:opacity-100 group-hover:opacity-100 data-[state=open]:opacity-100"
          aria-label={label}
        >
          <MoreHorizontalIcon aria-hidden />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">{children}</DropdownMenuContent>
    </DropdownMenu>
  );
}
