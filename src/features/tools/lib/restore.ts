import type { DumpContents, DumpNamespace, RestoreRequest } from "@/shared/ipc/bindings";

import { MAX_PARALLEL_COLLECTIONS, parseParallel, type DumpOutputKind } from "./dump";

/** Everything the restore dialog edits. */
export interface RestoreFormValues {
  kind: DumpOutputKind;
  path: string;
  /** Unticked namespaces, `db.collection`. */
  excluded: string[];
  /** New database names by original name; blank keeps the name. */
  renames: Record<string, string>;
  drop: boolean;
  dryRun: boolean;
  /** Only used when the dump has an oplog and everything is restored as is. */
  oplogReplay: boolean;
  parallel: string;
}

export interface RestoreFormErrors {
  path?: string;
  parallel?: string;
}

export const initialRestoreValues: RestoreFormValues = {
  kind: "folder",
  path: "",
  excluded: [],
  renames: {},
  drop: false,
  dryRun: false,
  oplogReplay: true,
  parallel: "",
};

export function namespaceKey(namespace: DumpNamespace): string {
  return `${namespace.database}.${namespace.collection}`;
}

/** Namespaces grouped by database, in the dump's order. */
export function databasesOf(contents: DumpContents): [string, DumpNamespace[]][] {
  const groups = new Map<string, DumpNamespace[]>();
  for (const namespace of contents.namespaces) {
    const group = groups.get(namespace.database) ?? [];
    group.push(namespace);
    groups.set(namespace.database, group);
  }
  return [...groups];
}

function effectiveRenames(values: RestoreFormValues) {
  return Object.entries(values.renames)
    .map(([from, to]) => ({ from, to: to.trim() }))
    .filter(({ from, to }) => to !== "" && to !== from);
}

/** mongorestore replays an oplog only for a full restore without new names. */
export function canReplayOplog(contents: DumpContents | undefined, values: RestoreFormValues) {
  return (
    contents?.oplog === true &&
    values.excluded.length === 0 &&
    effectiveRenames(values).length === 0
  );
}

export function validateRestoreForm(values: RestoreFormValues): RestoreFormErrors {
  const errors: RestoreFormErrors = {};
  if (values.path.trim() === "") {
    errors.path = values.kind === "folder" ? "Choose the dump folder." : "Choose the archive file.";
  }
  if (parseParallel(values.parallel) === undefined) {
    errors.parallel = `Enter a whole number from 1 to ${MAX_PARALLEL_COLLECTIONS}.`;
  }
  return errors;
}

/** The request sent to `start_restore`. */
export function buildRestoreRequest(
  values: RestoreFormValues,
  contents: DumpContents | undefined,
): RestoreRequest {
  return {
    source: { kind: values.kind, path: values.path.trim() },
    exclude: values.excluded,
    renames: effectiveRenames(values),
    drop: values.drop,
    dryRun: values.dryRun,
    oplogReplay: values.oplogReplay && canReplayOplog(contents, values),
    parallelCollections: parseParallel(values.parallel) ?? null,
  };
}
