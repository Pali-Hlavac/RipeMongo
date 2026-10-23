import { PencilIcon, PlayIcon, Trash2Icon } from "lucide-react";

import type { DumpProfile } from "@/shared/ipc/bindings";
import { Button } from "@/shared/ui/button";

import { dumpOptionsSummary, lastRunLabel, profileScope } from "../lib/profiles";

interface SavedDumpItemProps {
  profile: DumpProfile;
  /** Connecting or starting; the buttons are disabled meanwhile. */
  busy: boolean;
  onRun: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

/** One saved dump: what, where, options, last run, and its actions. */
export function SavedDumpItem({ profile, busy, onRun, onEdit, onDelete }: SavedDumpItemProps) {
  return (
    <li
      className="grid gap-1 rounded-md border border-border p-3"
      aria-label={profile.name}
      aria-busy={busy}
    >
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{profile.name}</p>
          <p className="truncate text-xs text-muted-foreground">{profileScope(profile)}</p>
        </div>
        <Button size="sm" disabled={busy} onClick={onRun}>
          <PlayIcon aria-hidden />
          {busy ? "Starting…" : "Run"}
        </Button>
        <Button
          size="icon"
          variant="ghost"
          disabled={busy}
          aria-label={`Edit ${profile.name}`}
          onClick={onEdit}
        >
          <PencilIcon aria-hidden />
        </Button>
        <Button
          size="icon"
          variant="ghost"
          disabled={busy}
          aria-label={`Delete ${profile.name}`}
          onClick={onDelete}
        >
          <Trash2Icon aria-hidden />
        </Button>
      </div>
      <p className="truncate font-mono text-xs" title={profile.request.output.path}>
        {profile.request.output.path}
      </p>
      <p className="text-xs text-muted-foreground">
        {dumpOptionsSummary(profile.request)} · {lastRunLabel(profile)}
      </p>
    </li>
  );
}
