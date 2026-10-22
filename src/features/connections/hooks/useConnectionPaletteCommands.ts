/** Command-palette entries contributed by the connections feature. */
import { DownloadIcon, PlugIcon, PlusIcon, UploadIcon } from "lucide-react";

import type { PaletteCommand } from "@/features/command-palette";

import { useConnections } from "../api/profiles";
import { useConnectionSession } from "../api/session";
import { useConnectionDialogs } from "../store/dialogs";

const GROUP = "Connections";

export function useConnectionPaletteCommands(): PaletteCommand[] {
  const { data: connections = [] } = useConnections();
  const { connect } = useConnectionSession();
  const { openCreate, setTransfer } = useConnectionDialogs.getState();

  const fixed: PaletteCommand[] = [
    {
      id: "connections.new",
      group: GROUP,
      label: "New connection…",
      icon: PlusIcon,
      run: openCreate,
    },
    {
      id: "connections.import",
      group: GROUP,
      label: "Import connections…",
      icon: DownloadIcon,
      run: () => {
        setTransfer("import");
      },
    },
    {
      id: "connections.export",
      group: GROUP,
      label: "Export connections…",
      icon: UploadIcon,
      run: () => {
        setTransfer("export");
      },
    },
  ];
  const perConnection = connections.map((profile): PaletteCommand => ({
    id: `connections.connect.${profile.id}`,
    group: GROUP,
    label: `Connect to ${profile.name}`,
    icon: PlugIcon,
    keywords: [profile.folder ?? "", "open"],
    run: () => void connect(profile),
  }));
  return [...fixed, ...perConnection];
}
