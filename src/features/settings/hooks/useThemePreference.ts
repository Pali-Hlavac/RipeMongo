import type { ThemePreference } from "@/shared/ipc/bindings";

import { useSettings, useUpdateSettings } from "../api/settings";

/** Current theme preference plus a setter that persists it. */
export function useThemePreference(): {
  preference: ThemePreference;
  setPreference: (theme: ThemePreference) => void;
} {
  const { data: settings } = useSettings();
  const { mutate } = useUpdateSettings();
  return {
    preference: settings?.theme ?? "system",
    setPreference: (theme) => {
      if (!settings) return;
      mutate({ ...settings, theme });
    },
  };
}
