/** Composes command-palette entries contributed by each feature. */
import {
  ArchiveIcon,
  InfoIcon,
  LayoutGridIcon,
  ListChecksIcon,
  MonitorIcon,
  MoonIcon,
  SunIcon,
  XIcon,
} from "lucide-react";

import { useAboutStore } from "@/features/about";
import type { PaletteCommand } from "@/features/command-palette";
import { useConnectionPaletteCommands } from "@/features/connections";
import { useJobsPanel } from "@/features/jobs";
import { THEME_OPTIONS, useThemePreference } from "@/features/settings";
import { useSavedDumpsDialog } from "@/features/tools";
import { TAB_HOTKEYS, WELCOME_TAB, useTabsStore } from "@/features/workspace";
import { APP_NAME } from "@/app.config";

const THEME_ICONS = { system: MonitorIcon, light: SunIcon, dark: MoonIcon } as const;

/** Every command available in the palette, in display order. */
export function useAppCommands(): PaletteCommand[] {
  const { setPreference } = useThemePreference();
  const tabs = useTabsStore.getState();
  const connectionCommands = useConnectionPaletteCommands();

  const themeCommands = THEME_OPTIONS.map((option): PaletteCommand => ({
    id: `theme.${option.value}`,
    group: "Appearance",
    label: `Theme: ${option.label}`,
    icon: THEME_ICONS[option.value],
    keywords: ["color", "mode", "appearance"],
    run: () => {
      setPreference(option.value);
    },
  }));

  return [
    ...connectionCommands,
    {
      id: "tabs.welcome",
      group: "Tabs",
      label: "Open Welcome tab",
      icon: LayoutGridIcon,
      run: () => {
        tabs.openTab(WELCOME_TAB);
      },
    },
    {
      id: "tabs.close",
      group: "Tabs",
      label: "Close current tab",
      icon: XIcon,
      hotkey: TAB_HOTKEYS.close,
      run: () => {
        const { activeTabId, closeTab } = useTabsStore.getState();
        if (activeTabId) closeTab(activeTabId);
      },
    },
    {
      id: "jobs.show",
      group: "Tools",
      label: "Show background jobs",
      icon: ListChecksIcon,
      keywords: ["dump", "restore", "import", "export", "progress"],
      run: () => {
        useJobsPanel.getState().setOpen(true);
      },
    },
    {
      id: "dumps.saved",
      group: "Tools",
      label: "Saved dumps",
      icon: ArchiveIcon,
      keywords: ["backup", "dump", "profile", "re-run"],
      run: () => {
        useSavedDumpsDialog.getState().setOpen(true);
      },
    },
    ...themeCommands,
    {
      id: "help.about",
      group: "Help",
      label: `About ${APP_NAME}`,
      icon: InfoIcon,
      keywords: ["version"],
      run: () => {
        useAboutStore.getState().setOpen(true);
      },
    },
  ];
}
