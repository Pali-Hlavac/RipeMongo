import { useEffect } from "react";

import { usePrefersDark } from "@/shared/hooks/usePrefersDark";

import { useThemePreference } from "../hooks/useThemePreference";
import { resolveTheme } from "../lib/theme";

/** Applies the resolved theme to `<html>` (the `dark` class and `color-scheme`). */
export function ThemeController() {
  const { preference } = useThemePreference();
  const systemPrefersDark = usePrefersDark();
  const theme = resolveTheme(preference, systemPrefersDark);

  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle("dark", theme === "dark");
    root.style.colorScheme = theme;
  }, [theme]);

  return null;
}
