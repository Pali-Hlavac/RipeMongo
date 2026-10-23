import { ArchiveIcon } from "lucide-react";
import { useState } from "react";

import { useJobsPanel } from "@/features/jobs";
import { ConfirmDialog } from "@/shared/components/ConfirmDialog";
import { EmptyState } from "@/shared/components/EmptyState";
import { ErrorState } from "@/shared/components/ErrorState";
import { InlineError } from "@/shared/components/InlineError";
import { LoadingState } from "@/shared/components/LoadingState";
import { useAfterDialogClose } from "@/shared/hooks/useAfterDialogClose";
import type { DumpProfile } from "@/shared/ipc/bindings";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/shared/ui/dialog";

import {
  useDeleteDumpProfile,
  useDumpProfiles,
  useRunDumpProfile,
  type EnsureConnected,
} from "../api/profiles";
import { useDumpDialog, useSavedDumpsDialog } from "../store/dump";
import { SavedDumpItem } from "./SavedDumpItem";

/** Saved dumps: run one with a click, edit or delete; mount once at the app root. */
export function SavedDumpsDialog({ ensureConnected }: { ensureConnected: EnsureConnected }) {
  const open = useSavedDumpsDialog((state) => state.open);
  const setOpen = useSavedDumpsDialog((state) => state.setOpen);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {open && (
        <SavedDumpsContent
          ensureConnected={ensureConnected}
          onClose={() => {
            setOpen(false);
          }}
        />
      )}
    </Dialog>
  );
}

interface ContentProps {
  ensureConnected: EnsureConnected;
  onClose: () => void;
}

function SavedDumpsContent({ ensureConnected, onClose }: ContentProps) {
  const { data: profiles, error, refetch, isPending } = useDumpProfiles();
  const run = useRunDumpProfile(ensureConnected);
  const remove = useDeleteDumpProfile();
  const [deleting, setDeleting] = useState<DumpProfile | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [editError, setEditError] = useState<unknown>(null);
  const closing = useAfterDialogClose();
  const shownError: unknown = run.error ?? editError;

  const runProfile = (profile: DumpProfile) => {
    setEditError(null);
    run.mutate(profile, {
      onSuccess: () => {
        closing.after(() => {
          useJobsPanel.getState().setOpen(true);
        });
        onClose();
      },
    });
  };

  const edit = async (profile: DumpProfile) => {
    run.reset();
    setEditError(null);
    setEditing(profile.id);
    try {
      // The collection list of a database dump needs a live connection.
      await ensureConnected(profile.connectionId);
    } catch (connectError) {
      setEditError(connectError);
      return;
    } finally {
      setEditing(null);
    }
    closing.after(() => {
      useDumpDialog.getState().edit(profile);
    });
    onClose();
  };

  return (
    <DialogContent
      className="flex max-h-[85vh] max-w-2xl flex-col"
      onCloseAutoFocus={closing.onCloseAutoFocus}
    >
      <DialogHeader>
        <DialogTitle>Saved dumps</DialogTitle>
        <DialogDescription>
          Run a saved dump again with one click. RipeMongo connects first if needed.
        </DialogDescription>
      </DialogHeader>
      {isPending && <LoadingState label="Loading saved dumps…" />}
      {error && (
        <ErrorState
          error={error}
          title="Could not load saved dumps"
          onRetry={() => void refetch()}
        />
      )}
      {profiles?.length === 0 && (
        <EmptyState
          icon={ArchiveIcon}
          title="No saved dumps yet"
          description="In the dump dialog, tick “Save for one-click re-runs”."
        />
      )}
      {shownError ? <InlineError error={shownError} /> : null}
      {profiles && profiles.length > 0 && (
        <ul className="-mx-1 grid min-h-0 gap-2 overflow-auto px-1" aria-label="Saved dumps">
          {profiles.map((profile) => (
            <SavedDumpItem
              key={profile.id}
              profile={profile}
              busy={(run.isPending && run.variables.id === profile.id) || editing === profile.id}
              onRun={() => {
                runProfile(profile);
              }}
              onEdit={() => void edit(profile)}
              onDelete={() => {
                setDeleting(profile);
              }}
            />
          ))}
        </ul>
      )}
      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(next) => {
          if (!next) setDeleting(null);
        }}
        title="Delete saved dump?"
        description={`“${deleting?.name ?? ""}” is removed from the list. Dumps it already made stay where they are.`}
        confirmLabel="Delete"
        destructive
        pending={remove.isPending}
        error={remove.error}
        onConfirm={() => {
          if (!deleting) return;
          remove.mutate(deleting.id, {
            onSuccess: () => {
              setDeleting(null);
            },
          });
        }}
      />
    </DialogContent>
  );
}
