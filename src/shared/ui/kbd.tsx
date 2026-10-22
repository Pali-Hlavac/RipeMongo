import type { ComponentProps } from "react";

import { formatHotkey } from "@/shared/lib/hotkeys";
import { cn } from "@/shared/lib/cn";
import { isMacPlatform } from "@/shared/lib/platform";

type KbdProps = Omit<ComponentProps<"kbd">, "children"> & {
  /** Hotkey combo such as `mod+k`; rendered with platform-specific labels. */
  combo: string;
};

/** Renders a keyboard shortcut hint. */
export function Kbd({ combo, className, ...props }: KbdProps) {
  return (
    <kbd
      className={cn(
        "pointer-events-none inline-flex h-5 items-center rounded border border-border bg-muted px-1.5 font-mono text-[11px] font-medium text-muted-foreground select-none",
        className,
      )}
      {...props}
    >
      {formatHotkey(combo, isMacPlatform())}
    </kbd>
  );
}
