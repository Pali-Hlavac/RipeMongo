import type { JobInfo } from "@/shared/ipc/bindings";

import { appendLog, MAX_LOG_LINES, progressPercent, progressText, upsertJob } from "./jobs";

function job(id: string, startedAt: number, status: JobInfo["status"] = "running"): JobInfo {
  return {
    id,
    kind: "dump",
    title: `Dump ${id}`,
    connectionId: "c1",
    status,
    progress: null,
    command: null,
    summary: null,
    error: null,
    startedAt,
    finishedAt: null,
    logLines: 0,
  };
}

describe("upsertJob", () => {
  it("adds new jobs newest first and replaces existing ones", () => {
    const list = upsertJob(upsertJob(undefined, job("a", 1)), job("b", 2));
    expect(list.map((item) => item.id)).toEqual(["b", "a"]);
    const updated = upsertJob(list, job("a", 1, "succeeded"));
    expect(updated.map((item) => [item.id, item.status])).toEqual([
      ["b", "running"],
      ["a", "succeeded"],
    ]);
  });
});

describe("appendLog", () => {
  it("keeps only the newest lines", () => {
    expect(appendLog(["a"], ["b", "c"])).toEqual(["a", "b", "c"]);
    const full = Array.from({ length: MAX_LOG_LINES }, (_, index) => String(index));
    const appended = appendLog(full, ["new"]);
    expect(appended).toHaveLength(MAX_LOG_LINES);
    expect(appended.at(-1)).toBe("new");
    expect(appended[0]).toBe("1");
  });
});

describe("progress", () => {
  it("reports a percentage only with a total", () => {
    const base = { unit: "documents" as const, message: null };
    expect(progressPercent({ ...base, done: 50, total: 200 })).toBe(25);
    expect(progressPercent({ ...base, done: 300, total: 200 })).toBe(100);
    expect(progressPercent({ ...base, done: 5, total: null })).toBeNull();
  });

  it("describes documents and bytes", () => {
    expect(progressText({ unit: "documents", done: 1200, total: 1500, message: null })).toBe(
      "1,200 of 1,500 documents",
    );
    expect(progressText({ unit: "documents", done: 1, total: null, message: null })).toBe(
      "1 document",
    );
    expect(progressText({ unit: "bytes", done: 2048, total: null, message: null })).toBe("2.0 KB");
  });
});
