import type { DumpOutput, DumpRequest } from "@/shared/ipc/bindings";

import type { DumpTarget } from "../store/dump";

export type DumpOutputKind = DumpOutput["kind"];
export type DumpScope = "server" | "database" | "collection";

/** Most collections dumped at the same time; the backend enforces the same limit. */
export const MAX_PARALLEL_COLLECTIONS = 16;
/** mongodump's own default for `--numParallelCollections`. */
export const DEFAULT_PARALLEL_COLLECTIONS = 4;

/** Everything the dump dialog edits. Text fields stay text until the request is built. */
export interface DumpFormValues {
  kind: DumpOutputKind;
  path: string;
  gzip: boolean;
  /** Collection dumps only. */
  query: string;
  /** Whole-server dumps only. */
  oplog: boolean;
  /** Database dumps only: unticked collections. */
  excluded: string[];
  /** Database dumps only: comma-separated name prefixes. */
  prefixes: string;
  /** Empty keeps the tool's default. */
  parallel: string;
  /** Save these settings as a saved dump (always on when editing one). */
  save: boolean;
  name: string;
}

export function dumpScopeKind(target: DumpTarget): DumpScope {
  if (target.database === null) return "server";
  return target.collection === null ? "database" : "collection";
}

/** "all databases", "shop", "shop.orders". */
export function dumpScope(target: DumpTarget): string {
  if (target.database === null) return "all databases";
  return target.collection === null ? target.database : `${target.database}.${target.collection}`;
}

/** The dump target of a saved request. */
export function targetOf(connectionId: string, request: DumpRequest): DumpTarget {
  return { connectionId, database: request.database, collection: request.collection };
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

/** Starting values: a fresh dump, or the settings of a saved one. */
export function initialDumpValues(
  target: DumpTarget,
  saved?: { name: string; request: DumpRequest },
): DumpFormValues {
  const request = saved?.request;
  return {
    kind: request?.output.kind ?? "folder",
    path: request?.output.path ?? "",
    gzip: request?.gzip ?? false,
    query: request?.query ?? "",
    oplog: request?.oplog ?? false,
    excluded: request?.excludeCollections ?? [],
    prefixes: request?.excludePrefixes.join(", ") ?? "",
    parallel: request?.parallelCollections?.toString() ?? "",
    save: saved !== undefined,
    name: saved?.name ?? `Dump ${dumpScope(target)}`,
  };
}

/** The parallelism typed by the user; `undefined` when it is not a whole number in range. */
export function parseParallel(text: string): number | null | undefined {
  const trimmed = text.trim();
  if (trimmed === "") return null;
  const value = Number(trimmed);
  return Number.isInteger(value) && value >= 1 && value <= MAX_PARALLEL_COLLECTIONS
    ? value
    : undefined;
}

export interface DumpFormErrors {
  path?: string;
  parallel?: string;
  name?: string;
}

/** Checks what the backend cannot explain field by field; empty when the form is complete. */
export function validateDumpForm(values: DumpFormValues): DumpFormErrors {
  const errors: DumpFormErrors = {};
  if (values.path.trim() === "") {
    errors.path = values.kind === "folder" ? "Choose a folder." : "Choose a file.";
  }
  if (parseParallel(values.parallel) === undefined) {
    errors.parallel = `Enter a whole number from 1 to ${MAX_PARALLEL_COLLECTIONS}.`;
  }
  if (values.save && values.name.trim() === "") errors.name = "Enter a name.";
  return errors;
}

/** "tmp_, ,cache_" → ["tmp_", "cache_"]. */
export function parsePrefixes(text: string): string[] {
  return text
    .split(",")
    .map((prefix) => prefix.trim())
    .filter((prefix) => prefix !== "");
}

/** The request sent to `start_dump`; options outside the target's scope are dropped. */
export function buildDumpRequest(target: DumpTarget, values: DumpFormValues): DumpRequest {
  const scope = dumpScopeKind(target);
  const query = values.query.trim();
  return {
    database: target.database,
    collection: target.collection,
    output: { kind: values.kind, path: values.path.trim() },
    gzip: values.gzip,
    query: scope === "collection" && query !== "" ? query : null,
    oplog: scope === "server" && values.oplog,
    excludeCollections: scope === "database" ? values.excluded : [],
    excludePrefixes: scope === "database" ? parsePrefixes(values.prefixes) : [],
    parallelCollections: scope === "collection" ? null : (parseParallel(values.parallel) ?? null),
  };
}
