import { useEffect, useRef } from "react";

import { matchesHotkey } from "@/shared/lib/hotkeys";
import { isMacPlatform } from "@/shared/lib/platform";

/**
 * Runs `handler` when the global keyboard combo is pressed (see `shared/lib/hotkeys`).
 * The latest handler is always used without re-registering the listener.
 */
export function useHotkey(combo: string, handler: (event: KeyboardEvent) => void): void {
  const handlerRef = useRef(handler);

  useEffect(() => {
    handlerRef.current = handler;
  }, [handler]);

  useEffect(() => {
    const isMac = isMacPlatform();
    const onKeyDown = (event: KeyboardEvent): void => {
      if (!matchesHotkey(event, combo, isMac)) return;
      event.preventDefault();
      handlerRef.current(event);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [combo]);
}
