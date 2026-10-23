/** Shared test data for the tools feature. */
import type { DumpProfile, DumpRequest, JobInfo } from "@/shared/ipc/bindings";

export const runningJob: JobInfo = {
  id: "j1",
  kind: "dump",
  title: "Dump shop",
  connectionId: "c1",
  status: "running",
  progress: null,
  command: null,
  summary: null,
  error: null,
  startedAt: 1,
  finishedAt: null,
  logLines: 0,
};

export function dumpRequest(overrides: Partial<DumpRequest> = {}): DumpRequest {
  return {
    database: "shop",
    collection: null,
    output: { kind: "folder", path: "C:\\dumps" },
    gzip: false,
    query: null,
    oplog: false,
    excludeCollections: [],
    excludePrefixes: [],
    parallelCollections: null,
    ...overrides,
  };
}

export function dumpProfile(overrides: Partial<DumpProfile> = {}): DumpProfile {
  return {
    id: "p1",
    name: "Nightly shop",
    connectionId: "c1",
    connectionName: "Local dev",
    request: dumpRequest(),
    createdAt: "2026-10-20T10:00:00Z",
    lastRunAt: null,
    ...overrides,
  };
}
