import type { ReactNode } from "react";

import { APP_NAME, APP_TAGLINE } from "@/app.config";
import { Kbd } from "@/shared/ui/kbd";

import { TAB_HOTKEYS } from "../hooks/useTabHotkeys";

/** Shortcuts listed on the welcome screen. The palette shortcut is passed in by the app shell. */
const WELCOME_SHORTCUTS = [
  { label: "Close tab", combo: TAB_HOTKEYS.close },
  { label: "Next tab", combo: TAB_HOTKEYS.next },
  { label: "Previous tab", combo: TAB_HOTKEYS.previous },
] as const;

interface WelcomeViewProps {
  paletteHotkey: string;
  /** Primary calls to action (e.g. "New connection"), supplied by the app shell. */
  actions?: ReactNode;
}

/** Landing tab shown on startup. */
export function WelcomeView({ paletteHotkey, actions }: WelcomeViewProps) {
  const shortcuts = [{ label: "Command palette", combo: paletteHotkey }, ...WELCOME_SHORTCUTS];
  return (
    <div className="mx-auto flex max-w-xl flex-col items-center gap-6 px-6 py-16 text-center">
      <img src="/icon.svg" alt="" className="size-20" />
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold">Welcome to {APP_NAME}</h1>
        <p className="text-muted-foreground">{APP_TAGLINE}</p>
      </div>
      {actions && <div className="flex flex-wrap justify-center gap-2">{actions}</div>}
      <dl className="grid w-full max-w-xs grid-cols-[1fr_auto] gap-x-6 gap-y-2 text-left text-sm">
        {shortcuts.map((shortcut) => (
          <div key={shortcut.label} className="contents">
            <dt className="text-muted-foreground">{shortcut.label}</dt>
            <dd>
              <Kbd combo={shortcut.combo} />
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
