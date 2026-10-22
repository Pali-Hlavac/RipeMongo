import { APP_NAME, APP_TAGLINE } from "@/app.config";
import { Kbd } from "@/shared/ui/kbd";

import { TAB_HOTKEYS } from "../hooks/useTabHotkeys";

/** Shortcuts listed on the welcome screen. The palette shortcut is passed in by the app shell. */
const WELCOME_SHORTCUTS = [
  { label: "Close tab", combo: TAB_HOTKEYS.close },
  { label: "Next tab", combo: TAB_HOTKEYS.next },
  { label: "Previous tab", combo: TAB_HOTKEYS.previous },
] as const;

/** Landing tab shown on startup. */
export function WelcomeTab({ paletteHotkey }: { paletteHotkey: string }) {
  const shortcuts = [{ label: "Command palette", combo: paletteHotkey }, ...WELCOME_SHORTCUTS];
  return (
    <div className="mx-auto flex max-w-xl flex-col items-center gap-6 px-6 py-16 text-center">
      <img src="/icon.svg" alt="" className="size-20" />
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold">Welcome to {APP_NAME}</h1>
        <p className="text-muted-foreground">{APP_TAGLINE}</p>
      </div>
      <p className="text-sm text-muted-foreground">
        Connection management arrives in the next milestone. Until then you can explore the shell:
        tabs, themes and the command palette.
      </p>
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
