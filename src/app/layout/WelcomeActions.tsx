import { DownloadIcon, PlusIcon } from "lucide-react";

import { useConnectionDialogs } from "@/features/connections";
import { Button } from "@/shared/ui/button";

/** Primary calls to action on the welcome tab. */
export function WelcomeActions() {
  const { openCreate, setTransfer } = useConnectionDialogs.getState();
  return (
    <>
      <Button onClick={openCreate}>
        <PlusIcon aria-hidden /> New connection
      </Button>
      <Button
        variant="outline"
        onClick={() => {
          setTransfer("import");
        }}
      >
        <DownloadIcon aria-hidden /> Import connections
      </Button>
    </>
  );
}
