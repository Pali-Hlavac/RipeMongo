/**
 * Hotkey parsing, matching and formatting. Combos are written like `mod+k` or
 * `mod+shift+p`, where `mod` means Cmd on macOS and Ctrl elsewhere.
 */

export interface ParsedHotkey {
  key: string;
  ctrl: boolean;
  meta: boolean;
  shift: boolean;
  alt: boolean;
}

/** Parses a combo string for the given platform. */
export function parseHotkey(combo: string, isMac: boolean): ParsedHotkey {
  const parts = combo.toLowerCase().split("+");
  const has = (name: string): boolean => parts.includes(name);
  const mod = has("mod");
  return {
    key: parts.at(-1) ?? "",
    ctrl: has("ctrl") || (mod && !isMac),
    meta: has("meta") || (mod && isMac),
    shift: has("shift"),
    alt: has("alt"),
  };
}

type KeyEventLike = Pick<KeyboardEvent, "key" | "ctrlKey" | "metaKey" | "shiftKey" | "altKey">;

/** True when the keyboard event exactly matches the combo (no extra modifiers). */
export function matchesHotkey(event: KeyEventLike, combo: string, isMac: boolean): boolean {
  const hotkey = parseHotkey(combo, isMac);
  return (
    event.key.toLowerCase() === hotkey.key &&
    event.ctrlKey === hotkey.ctrl &&
    event.metaKey === hotkey.meta &&
    event.shiftKey === hotkey.shift &&
    event.altKey === hotkey.alt
  );
}

const MAC_SYMBOLS: Record<string, string> = {
  mod: "⌘",
  meta: "⌘",
  ctrl: "⌃",
  shift: "⇧",
  alt: "⌥",
};
const PC_LABELS: Record<string, string> = {
  mod: "Ctrl",
  meta: "Win",
  ctrl: "Ctrl",
  shift: "Shift",
  alt: "Alt",
};

/** Human-readable label, e.g. `⌘K` on macOS and `Ctrl+K` elsewhere. */
export function formatHotkey(combo: string, isMac: boolean): string {
  const labels = isMac ? MAC_SYMBOLS : PC_LABELS;
  const parts = combo
    .split("+")
    .map((part) => labels[part.toLowerCase()] ?? part.charAt(0).toUpperCase() + part.slice(1));
  return parts.join(isMac ? "" : "+");
}
