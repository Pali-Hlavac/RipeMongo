import { useQuery } from "@tanstack/react-query";
import { PencilIcon, PlugIcon, SearchXIcon, UnplugIcon } from "lucide-react";

import { EmptyState } from "@/shared/components/EmptyState";
import { ErrorState } from "@/shared/components/ErrorState";
import { LoadingState } from "@/shared/components/LoadingState";
import { call, commands } from "@/shared/ipc/client";
import { cn } from "@/shared/lib/cn";
import { Button } from "@/shared/ui/button";

import { connectionKeys } from "../../api/keys";
import { useConnections } from "../../api/profiles";
import { useConnectionSession } from "../../api/session";
import { useConnectionStatus } from "../../hooks/useConnectionStatus";
import { colorClass } from "../../lib/colors";
import { useConnectionDialogs } from "../../store/dialogs";
import { STATUS_LABELS, useConnectionStatusStore } from "../../store/status";
import type { ConnectionProfile } from "../../types";
import { ServerSummary } from "../ServerSummary";
import { StatusIndicator } from "../StatusIndicator";

/** Workspace tab for one connection: status, connection string and server details. */
export function ConnectionOverview({ connectionId }: { connectionId: string }) {
  const { data: connections, isPending } = useConnections();
  const profile = connections?.find((candidate) => candidate.id === connectionId);
  if (isPending) return <LoadingState label="Loading connection…" />;
  if (!profile) {
    return (
      <EmptyState
        icon={SearchXIcon}
        title="Connection not found"
        description="It may have been deleted. Close this tab."
        className="h-full"
      />
    );
  }
  return <Overview profile={profile} />;
}

function Overview({ profile }: { profile: ConnectionProfile }) {
  const { status, active } = useConnectionStatus(profile.id);
  const pending = useConnectionStatusStore((state) => state.pending[profile.id]);
  const { connect, disconnect } = useConnectionSession();
  const openEdit = useConnectionDialogs((state) => state.openEdit);
  const uri = useQuery({
    queryKey: [...connectionKeys.all, "display-uri", profile.config],
    queryFn: () => call(commands.buildConnectionString(profile.config)),
  });

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6 px-6 py-8">
      <header className="flex items-start gap-3">
        <span aria-hidden className={cn("mt-1.5 size-3 rounded-full", colorClass(profile.color))} />
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-xl font-semibold">{profile.name}</h1>
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <StatusIndicator status={status} />
            {STATUS_LABELS[status]}
            {profile.folder && <span>· {profile.folder}</span>}
          </p>
        </div>
        <Button
          variant="outline"
          onClick={() => {
            openEdit(profile.id);
          }}
        >
          <PencilIcon aria-hidden /> Edit
        </Button>
        {status === "connected" ? (
          <Button variant="outline" onClick={() => void disconnect(profile.id)}>
            <UnplugIcon aria-hidden /> Disconnect
          </Button>
        ) : (
          <Button disabled={status === "connecting"} onClick={() => void connect(profile)}>
            <PlugIcon aria-hidden /> Connect
          </Button>
        )}
      </header>

      <section aria-label="Connection string" className="rounded-md border border-border p-3">
        <p className="mb-1 text-xs font-medium text-muted-foreground">Connection string</p>
        <code className="block font-mono text-sm break-all select-text">{uri.data ?? "…"}</code>
        {profile.config.ssh && (
          <p className="mt-2 text-xs text-muted-foreground">
            Through SSH tunnel {profile.config.ssh.username}@{profile.config.ssh.host}:
            {profile.config.ssh.port}
          </p>
        )}
      </section>

      {status === "connecting" && <LoadingState label="Connecting…" />}
      {status === "failed" && pending?.state === "failed" && (
        <ErrorState
          error={pending.error}
          title="Could not connect"
          onRetry={() => void connect(profile)}
        />
      )}
      {active && (
        <section aria-label="Server" className="grid gap-3">
          <h2 className="text-sm font-semibold">Server</h2>
          <ServerSummary server={active.server} viaSsh={active.viaSsh} />
        </section>
      )}
      <p className="rounded-md bg-muted/60 p-3 text-sm text-muted-foreground">
        {status === "connected"
          ? "Databases and collections are listed under this connection in the sidebar."
          : "Connect to browse this server's databases and collections in the sidebar."}
      </p>
    </div>
  );
}
