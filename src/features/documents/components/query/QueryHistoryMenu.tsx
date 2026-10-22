import { HistoryIcon, SettingsIcon, StarIcon } from "lucide-react";
import { useState } from "react";

import { Button } from "@/shared/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/shared/ui/dropdown-menu";

import { useQueryHistory } from "../../api/history";
import type { CollectionTarget } from "../../api/keys";
import { describeQuery } from "../../lib/query";
import type { AppliedQuery } from "../../store/view";
import type { SavedQuery } from "../../types";
import { FavoritesDialog, SaveFavoriteDialog } from "./FavoriteDialogs";

interface QueryHistoryMenuProps {
  target: CollectionTarget;
  /** What the bar currently shows; saved by "Save as favorite". */
  draft: AppliedQuery;
  onPick: (query: AppliedQuery) => void;
}

/** Favorites and recent queries of this collection; picking one runs it. */
export function QueryHistoryMenu({ target, draft, onPick }: QueryHistoryMenuProps) {
  const { data } = useQueryHistory(target);
  const [dialog, setDialog] = useState<"save" | "manage" | null>(null);
  const pick = (saved: SavedQuery) => {
    onPick({ ...saved.query, skip: 0, limit: 0, maxTimeMs: draft.maxTimeMs });
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button type="button" variant="ghost" size="sm">
            <HistoryIcon aria-hidden /> History
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="max-w-[32rem]">
          <DropdownMenuItem
            onSelect={() => {
              setDialog("save");
            }}
          >
            <StarIcon aria-hidden /> Save as favorite…
          </DropdownMenuItem>
          {data && data.favorites.length > 0 && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuLabel>Favorites</DropdownMenuLabel>
              {data.favorites.map((saved) => (
                <SavedItem key={saved.id} saved={saved} onPick={pick} />
              ))}
              <DropdownMenuItem
                onSelect={() => {
                  setDialog("manage");
                }}
              >
                <SettingsIcon aria-hidden /> Manage favorites…
              </DropdownMenuItem>
            </>
          )}
          <DropdownMenuSeparator />
          <DropdownMenuLabel>Recent</DropdownMenuLabel>
          {data && data.recent.length > 0 ? (
            data.recent.map((saved) => <SavedItem key={saved.id} saved={saved} onPick={pick} />)
          ) : (
            <p className="px-2 py-1.5 text-sm text-muted-foreground">
              Queries you run appear here.
            </p>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
      <SaveFavoriteDialog
        open={dialog === "save"}
        onClose={() => {
          setDialog(null);
        }}
        target={target}
        query={draft}
      />
      <FavoritesDialog
        open={dialog === "manage"}
        onClose={() => {
          setDialog(null);
        }}
        target={target}
        favorites={data?.favorites ?? []}
      />
    </>
  );
}

function SavedItem({ saved, onPick }: { saved: SavedQuery; onPick: (saved: SavedQuery) => void }) {
  const summary = describeQuery(saved.query);
  return (
    <DropdownMenuItem
      title={summary}
      onSelect={() => {
        onPick(saved);
      }}
    >
      <span className="flex min-w-0 flex-col">
        {saved.name && <span className="truncate font-medium">{saved.name}</span>}
        <span className="truncate font-mono text-xs text-muted-foreground">{summary}</span>
      </span>
    </DropdownMenuItem>
  );
}
