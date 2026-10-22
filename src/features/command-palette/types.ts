import type { LucideIcon } from "lucide-react";

/** An action that can be run from the command palette. */
export interface PaletteCommand {
  /** Unique, stable id; also used as the cmdk item value. */
  id: string;
  /** Heading the command is grouped under, e.g. "Appearance". */
  group: string;
  label: string;
  icon?: LucideIcon;
  /** Hotkey combo that runs the same action, shown as a hint. */
  hotkey?: string;
  /** Extra search terms that are not part of the label. */
  keywords?: string[];
  run: () => void;
}
