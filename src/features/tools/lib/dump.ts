import type { DumpOutput, DumpRequest } from "@/shared/ipc/bindings";

import type { DumpTarget } from "../store/dump";

export type DumpOutputKind = DumpOutput["kind"];

/** "all databases", "shop", "shop.orders". */
export function dumpScope(target: DumpTarget): string {
  if (target.database === null) return "all databases";
  return target.collection === null ? target.database : `${target.database}.${target.collection}`;
}

/** Suggested archive file name, e.g. `shop.orders-2026-10-22.archive.gz`. */
export function defaultArchiveName(target: DumpTarget, gzip: boolean, today = new Date()): string {
  const base = target.database === null ? "all-databases" : dumpScope(target);
  const date = [
    today.getFullYear(),
    String(today.getMonth() + 1).padStart(2, "0"),
    String(today.getDate()).padStart(2, "0"),
  ].join("-");
  return `${base}-${date}.archive${gzip ? ".gz" : ""}`;
}

/** The request sent to `start_dump`. */
export function buildDumpRequest(
  target: DumpTarget,
  kind: DumpOutputKind,
  path: string,
  gzip: boolean,
): DumpRequest {
  return {
    database: target.database,
    collection: target.collection,
    output: { kind, path: path.trim() },
    gzip,
  };
}
