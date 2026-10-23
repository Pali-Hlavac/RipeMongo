import type { DumpProfile, DumpRequest } from "@/shared/ipc/bindings";

import { dumpScope, targetOf } from "./dump";

/** "shop.orders on Local dev". */
export function profileScope(profile: DumpProfile): string {
  const target = targetOf(profile.connectionId, profile.request);
  return `${dumpScope(target)} on ${profile.connectionName}`;
}

/** Short list of the options that differ from a plain dump: "Archive · gzip · filtered". */
export function dumpOptionsSummary(request: DumpRequest): string {
  const parts = [request.output.kind === "folder" ? "Folder" : "Archive"];
  if (request.gzip) parts.push("gzip");
  if (request.query) parts.push("filtered");
  if (request.oplog) parts.push("oplog");
  const left = request.excludeCollections.length + request.excludePrefixes.length;
  if (left > 0) parts.push(`${left} exclusion${left === 1 ? "" : "s"}`);
  if (request.parallelCollections !== null) parts.push(`${request.parallelCollections} at a time`);
  return parts.join(" · ");
}

/** "Last run 23 Oct 2026, 11:47" or "Never run". */
export function lastRunLabel(profile: DumpProfile, locale?: string): string {
  if (profile.lastRunAt === null) return "Never run";
  const date = new Date(profile.lastRunAt);
  const formatted = date.toLocaleString(locale, { dateStyle: "medium", timeStyle: "short" });
  return `Last run ${formatted}`;
}
