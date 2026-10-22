import {
  CopyIcon,
  MoreHorizontalIcon,
  PencilIcon,
  PlugIcon,
  StarIcon,
  StarOffIcon,
  Trash2Icon,
  UnplugIcon,
} from "lucide-react";

import { CatalogConnectionMenuItems } from "@/features/catalog";
import { Button } from "@/shared/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/shared/ui/dropdown-menu";

import { useDuplicateConnection, useSaveConnection } from "../../api/profiles";
import { useConnectionSession } from "../../api/session";
import { useConnectionDialogs } from "../../store/dialogs";
import type { ConnectionStatus } from "../../store/status";
import type { ConnectionProfile } from "../../types";

interface ConnectionActionsMenuProps {
  profile: ConnectionProfile;
  status: ConnectionStatus;
}

/**
 * "⋯" menu of a sidebar item: connect/disconnect, database actions while connected, edit,
 * duplicate, favorite, delete.
 */
export function ConnectionActionsMenu({ profile, status }: ConnectionActionsMenuProps) {
  const { connect, disconnect } = useConnectionSession();
  const duplicate = useDuplicateConnection();
  const save = useSaveConnection();
  const { openEdit, setDeleteTarget } = useConnectionDialogs.getState();
  const connected = status === "connected";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="size-6 opacity-0 group-focus-within:opacity-100 group-hover:opacity-100 data-[state=open]:opacity-100"
          aria-label={`Actions for ${profile.name}`}
        >
          <MoreHorizontalIcon aria-hidden />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        {connected ? (
          <>
            <DropdownMenuItem onSelect={() => void disconnect(profile.id)}>
              <UnplugIcon aria-hidden /> Disconnect
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <CatalogConnectionMenuItems connectionId={profile.id} />
            <DropdownMenuSeparator />
          </>
        ) : (
          <DropdownMenuItem
            disabled={status === "connecting"}
            onSelect={() => void connect(profile)}
          >
            <PlugIcon aria-hidden /> Connect
          </DropdownMenuItem>
        )}
        <DropdownMenuItem
          onSelect={() => {
            openEdit(profile.id);
          }}
        >
          <PencilIcon aria-hidden /> Edit…
        </DropdownMenuItem>
        <DropdownMenuItem
          onSelect={() => {
            duplicate.mutate(profile.id);
          }}
        >
          <CopyIcon aria-hidden /> Duplicate
        </DropdownMenuItem>
        <DropdownMenuItem
          onSelect={() => {
            save.mutate({ profile: { ...profile, favorite: !profile.favorite } });
          }}
        >
          {profile.favorite ? <StarOffIcon aria-hidden /> : <StarIcon aria-hidden />}
          {profile.favorite ? "Remove from favorites" : "Add to favorites"}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          destructive
          onSelect={() => {
            setDeleteTarget(profile.id);
          }}
        >
          <Trash2Icon aria-hidden /> Delete…
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
