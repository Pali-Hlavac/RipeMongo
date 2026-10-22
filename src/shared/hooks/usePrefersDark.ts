import { useSyncExternalStore } from "react";

const DARK_QUERY = "(prefers-color-scheme: dark)";

function subscribe(onChange: () => void): () => void {
  const media = window.matchMedia(DARK_QUERY);
  media.addEventListener("change", onChange);
  return () => {
    media.removeEventListener("change", onChange);
  };
}

function getSnapshot(): boolean {
  return window.matchMedia(DARK_QUERY).matches;
}

/** Live value of the operating system's dark-mode preference. */
export function usePrefersDark(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot);
}
