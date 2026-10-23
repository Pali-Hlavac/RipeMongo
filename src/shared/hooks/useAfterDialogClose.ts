import { useRef } from "react";

/**
 * Runs an action once a dialog has finished closing, for actions that open another dialog or
 * panel. Radix returns focus to the element that opened the dialog only after it unmounts; a
 * dialog opened before that sees the focus land outside it and closes again. Pass
 * `onCloseAutoFocus` to `DialogContent` and call `after(action)` right before closing. The
 * focus still returns as usual, so the next dialog's focus scope starts from there.
 */
export function useAfterDialogClose() {
  const pending = useRef<(() => void) | null>(null);
  return {
    after: (action: () => void) => {
      pending.current = action;
    },
    onCloseAutoFocus: () => {
      const action = pending.current;
      pending.current = null;
      action?.();
    },
  };
}
