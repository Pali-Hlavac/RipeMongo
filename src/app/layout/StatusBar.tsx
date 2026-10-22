import { useAppInfo } from "@/features/about";
import { PALETTE_HOTKEY, usePaletteStore } from "@/features/command-palette";
import { ThemeMenu } from "@/features/settings";
import { Button } from "@/shared/ui/button";
import { Kbd } from "@/shared/ui/kbd";

/** Bottom bar: app version on the left, palette hint and theme switch on the right. */
export function StatusBar() {
  const { data: info } = useAppInfo();
  return (
    <footer className="flex h-7 shrink-0 items-center justify-between border-t border-border bg-muted/40 px-2 text-xs text-muted-foreground">
      <span>{info ? `${info.name} ${info.version}` : " "}</span>
      <div className="flex items-center gap-1">
        <Button
          variant="ghost"
          size="sm"
          className="h-6 gap-1.5 px-2 text-xs"
          onClick={() => {
            usePaletteStore.getState().setOpen(true);
          }}
        >
          Commands <Kbd combo={PALETTE_HOTKEY} />
        </Button>
        <ThemeMenu />
      </div>
    </footer>
  );
}
