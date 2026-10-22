import { APP_TAGLINE } from "@/app.config";
import { ErrorState } from "@/shared/components/ErrorState";
import { LoadingState } from "@/shared/components/LoadingState";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/shared/ui/dialog";

import { useAppInfo } from "../api/appInfo";
import { useAboutStore } from "../store/about";

/** Shows the app version and platform; handy for bug reports. */
export function AboutDialog() {
  const open = useAboutStore((state) => state.open);
  const { setOpen } = useAboutStore.getState();
  const { data: info, error, isPending, refetch } = useAppInfo();

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-sm">
        <DialogHeader className="items-center text-center">
          <img src="/icon.svg" alt="" className="size-16" />
          <DialogTitle>{info?.name ?? "About"}</DialogTitle>
          <DialogDescription>{APP_TAGLINE}</DialogDescription>
        </DialogHeader>
        {isPending && <LoadingState label="Loading version information…" />}
        {error && (
          <ErrorState
            error={error}
            title="Could not load version information"
            onRetry={() => void refetch()}
          />
        )}
        {info && (
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
            <dt className="text-muted-foreground">Version</dt>
            <dd className="font-mono">{info.version}</dd>
            <dt className="text-muted-foreground">Platform</dt>
            <dd className="font-mono">
              {info.os} / {info.arch}
            </dd>
          </dl>
        )}
      </DialogContent>
    </Dialog>
  );
}
