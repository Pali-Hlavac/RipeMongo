import { DatabaseIcon, DownloadIcon, MoreVerticalIcon, PlusIcon, UploadIcon } from "lucide-react";

import { EmptyState } from "@/shared/components/EmptyState";
import { ErrorState } from "@/shared/components/ErrorState";
import { LoadingState } from "@/shared/components/LoadingState";
import { Button } from "@/shared/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/shared/ui/dropdown-menu";
import { Tooltip } from "@/shared/ui/tooltip";

import { useConnections } from "../../api/profiles";
import { buildConnectionTree } from "../../lib/tree";
import { useConnectionDialogs } from "../../store/dialogs";
import type { ConnectionProfile } from "../../types";
import { ConnectionGroup } from "./ConnectionGroup";

/** Left navigation: saved connections grouped into favorites, folders and the rest. */
export function ConnectionSidebar() {
  const { data, error, isPending, refetch } = useConnections();
  const { openCreate, setTransfer } = useConnectionDialogs.getState();

  return (
    <nav aria-label="Connections" className="flex h-full flex-col bg-muted/40">
      <div className="flex h-9 shrink-0 items-center gap-1 border-b border-border pr-1 pl-3">
        <h2 className="flex-1 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
          Connections
        </h2>
        <Tooltip content="New connection">
          <Button
            variant="ghost"
            size="icon"
            className="size-7"
            aria-label="New connection"
            onClick={openCreate}
          >
            <PlusIcon aria-hidden />
          </Button>
        </Tooltip>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="size-7"
              aria-label="More connection actions"
            >
              <MoreVerticalIcon aria-hidden />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem
              onSelect={() => {
                setTransfer("import");
              }}
            >
              <DownloadIcon aria-hidden /> Import connections…
            </DropdownMenuItem>
            <DropdownMenuItem
              disabled={!data?.length}
              onSelect={() => {
                setTransfer("export");
              }}
            >
              <UploadIcon aria-hidden /> Export connections…
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-1">
        {isPending && <LoadingState label="Loading connections…" />}
        {error && (
          <ErrorState
            error={error}
            title="Could not load connections"
            onRetry={() => void refetch()}
          />
        )}
        {data &&
          (data.length === 0 ? (
            <EmptyState
              icon={DatabaseIcon}
              title="No connections yet"
              description="Add a MongoDB server or paste a connection string to get started."
              className="h-full"
              action={
                <Button size="sm" onClick={openCreate}>
                  <PlusIcon aria-hidden /> New connection
                </Button>
              }
            />
          ) : (
            <ConnectionTreeView profiles={data} />
          ))}
      </div>
    </nav>
  );
}

function ConnectionTreeView({ profiles }: { profiles: ConnectionProfile[] }) {
  const tree = buildConnectionTree(profiles);
  const onlyUngrouped = tree.favorites.length === 0 && tree.folders.length === 0;
  return (
    <div className="flex flex-col gap-2">
      <ConnectionGroup title="Favorites" connections={tree.favorites} />
      {tree.folders.map((folder) => (
        <ConnectionGroup key={folder.name} title={folder.name} connections={folder.connections} />
      ))}
      <ConnectionGroup title="Other" connections={tree.ungrouped} untitled={onlyUngrouped} />
    </div>
  );
}
