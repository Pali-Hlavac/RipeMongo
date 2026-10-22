import type { ServerInfo, TopologyKind } from "@/shared/ipc/bindings";

const TOPOLOGY_LABELS: Record<TopologyKind, string> = {
  standalone: "Standalone",
  replicaSet: "Replica set",
  sharded: "Sharded cluster (mongos)",
};

/** Key facts about a connected server, as a definition list. */
export function ServerSummary({ server, viaSsh }: { server: ServerInfo; viaSsh?: boolean }) {
  const rows: [string, string][] = [
    ["Version", server.version],
    ["Topology", TOPOLOGY_LABELS[server.topology]],
  ];
  if (server.replicaSetName) rows.push(["Replica set", server.replicaSetName]);
  if (server.primary) rows.push(["Primary", server.primary]);
  if (server.hosts.length > 0) rows.push(["Members", server.hosts.join(", ")]);
  rows.push(["Writable", server.writable ? "Yes" : "No (secondary or arbiter)"]);
  if (viaSsh !== undefined) rows.push(["SSH tunnel", viaSsh ? "Yes" : "No"]);

  return (
    <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-1.5 text-sm">
      {rows.map(([label, value]) => (
        <div key={label} className="contents">
          <dt className="text-muted-foreground">{label}</dt>
          <dd className="font-mono break-all">{value}</dd>
        </div>
      ))}
    </dl>
  );
}
