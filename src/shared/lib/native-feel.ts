/**
 * Suppresses browser behaviour that breaks the native-app illusion in production builds:
 * the webview context menu (Back/Refresh/Print/Inspect) and reload/print shortcuts.
 * Editable fields keep their context menu so copy/paste still works.
 */
import { matchesHotkey } from "./hotkeys";
import { isMacPlatform } from "./platform";

/** Browser shortcuts that would reload or print the app window. */
const BLOCKED_HOTKEYS = ["f5", "mod+r", "mod+shift+r", "mod+p"] as const;

const EDITABLE_SELECTOR = "input, textarea, [contenteditable='true'], .monaco-editor";

function isEditableTarget(target: EventTarget | null): boolean {
  return target instanceof Element && target.closest(EDITABLE_SELECTOR) !== null;
}

/** Installs the global listeners. Call once at startup, only in production. */
export function installNativeFeel(): void {
  const isMac = isMacPlatform();
  window.addEventListener("contextmenu", (event) => {
    if (!isEditableTarget(event.target)) event.preventDefault();
  });
  window.addEventListener("keydown", (event) => {
    if (BLOCKED_HOTKEYS.some((combo) => matchesHotkey(event, combo, isMac))) {
      event.preventDefault();
    }
  });
}
