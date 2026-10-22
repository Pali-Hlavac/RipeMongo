import { useHotkey } from "@/shared/hooks/useHotkey";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/shared/ui/command";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/shared/ui/dialog";
import { Kbd } from "@/shared/ui/kbd";

import { groupCommands } from "../lib/group";
import { usePaletteStore } from "../store/palette";
import type { PaletteCommand } from "../types";

export const PALETTE_HOTKEY = "mod+k";

/** Searchable list of every registered command, toggled with {@link PALETTE_HOTKEY}. */
export function CommandPalette({ commands }: { commands: readonly PaletteCommand[] }) {
  const open = usePaletteStore((state) => state.open);
  const { setOpen, toggle } = usePaletteStore.getState();
  useHotkey(PALETTE_HOTKEY, toggle);

  const runCommand = (command: PaletteCommand): void => {
    setOpen(false);
    command.run();
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="overflow-hidden p-0" showCloseButton={false}>
        <DialogTitle className="sr-only">Command palette</DialogTitle>
        <DialogDescription className="sr-only">Search for a command to run.</DialogDescription>
        <Command loop label="Search commands">
          <CommandInput placeholder="Type a command or search…" />
          <CommandList>
            <CommandEmpty>No matching commands.</CommandEmpty>
            {groupCommands(commands).map(([group, items]) => (
              <CommandGroup key={group} heading={group}>
                {items.map((command) => {
                  const Icon = command.icon;
                  return (
                    <CommandItem
                      key={command.id}
                      value={command.id}
                      keywords={[command.label, ...(command.keywords ?? [])]}
                      onSelect={() => {
                        runCommand(command);
                      }}
                    >
                      {Icon && <Icon aria-hidden />}
                      <span className="flex-1">{command.label}</span>
                      {command.hotkey && <Kbd combo={command.hotkey} />}
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            ))}
          </CommandList>
        </Command>
      </DialogContent>
    </Dialog>
  );
}
