import { useQueryClient } from "@tanstack/react-query";
import { Toaster } from "sonner";

import { AboutDialog } from "@/features/about";
import { catalogKeys, CatalogDialogs } from "@/features/catalog";
import { CommandPalette } from "@/features/command-palette";
import { documentKeys } from "@/features/documents";
import { ConnectionDialogs, useEnsureConnected } from "@/features/connections";
import { JobsPanel, useJobEvents } from "@/features/jobs";
import { ThemeController, useSettings, useThemePreference } from "@/features/settings";
import {
  DumpDialog,
  ExportDialog,
  ImportDialog,
  RestoreDialog,
  SavedDumpsDialog,
} from "@/features/tools";
import { LoadingState } from "@/shared/components/LoadingState";

import { useAppCommands } from "./commands/useAppCommands";
import { AppLayout } from "./layout/AppLayout";

/**
 * Root component. Waits for settings so the first paint already uses the saved theme;
 * if settings fail to load, the app still starts with defaults and shows a toast.
 */
export function App() {
  const { isPending } = useSettings();
  const { preference } = useThemePreference();
  const commands = useAppCommands();
  const ensureConnected = useEnsureConnected();
  const queryClient = useQueryClient();
  // A restore or import (even a cancelled one) may have created collections and documents.
  useJobEvents((job) => {
    if (job.kind === "restore" || job.kind === "import") {
      void queryClient.invalidateQueries({ queryKey: catalogKeys.connection(job.connectionId) });
      void queryClient.invalidateQueries({ queryKey: documentKeys.connection(job.connectionId) });
    }
  });

  if (isPending) return <LoadingState label="Starting…" className="h-screen" />;

  return (
    <>
      <ThemeController />
      <AppLayout />
      <CommandPalette commands={commands} />
      <AboutDialog />
      <ConnectionDialogs />
      <CatalogDialogs />
      <DumpDialog />
      <SavedDumpsDialog ensureConnected={ensureConnected} />
      <RestoreDialog />
      <ExportDialog />
      <ImportDialog />
      <JobsPanel />
      <Toaster theme={preference} position="bottom-right" richColors closeButton />
    </>
  );
}
