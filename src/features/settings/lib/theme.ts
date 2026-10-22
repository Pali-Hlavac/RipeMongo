/** Pure theme helpers shared by the theme controller, menu and command palette. */
import type { ThemePreference } from "@/shared/ipc/bindings";

export type ResolvedTheme = "light" | "dark";

/** Theme options in display order. */
export const THEME_OPTIONS: readonly { value: ThemePreference; label: string }[] = [
  { value: "system", label: "System" },
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
];

/** Turns the stored preference into the theme that is actually applied. */
export function resolveTheme(
  preference: ThemePreference,
  systemPrefersDark: boolean,
): ResolvedTheme {
  if (preference === "system") return systemPrefersDark ? "dark" : "light";
  return preference;
}

/** Type guard for values coming from untyped UI events (e.g. radio groups). */
export function isThemePreference(value: string): value is ThemePreference {
  return THEME_OPTIONS.some((option) => option.value === value);
}
