import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { EngineWeb } from "../engine.web";
import { DEMO_ASSETS } from "../demoData";
import { EMPTY_FILTER, type JobReport } from "../types";

// Mirrors the spirit of the Phase 1 exit test (docs/CONTEXT.md §13): back up the
// same set twice and confirm the second run copies nothing — the mock engine's
// `backedUpIds` fast path must behave like the real one-copy invariant.
async function runToCompletion(engine: EngineWeb, jobId: string): Promise<JobReport> {
  return new Promise((resolve) => {
    void engine.addListener("jobFinished", (report) => {
      if (report.jobId === jobId) resolve(report);
    });
  });
}

describe("EngineWeb backup", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("skips every item as a duplicate on the second run of the same filter", async () => {
    const engine = new EngineWeb();
    const filter = { ...EMPTY_FILTER };

    const first = await engine.startJob({
      kind: "backup",
      filter,
      options: {
        includeEdited: true,
        downloadFromICloud: true,
        wifiOnly: true,
        includeSharedAlbums: false,
      },
    });
    const firstDone = runToCompletion(engine, first.jobId);
    await vi.runAllTimersAsync();
    const firstReport = await firstDone;

    expect(firstReport.copied).toBeGreaterThan(0);
    expect(firstReport.copied + firstReport.skippedDuplicate).toBe(DEMO_ASSETS.length);

    const second = await engine.startJob({
      kind: "backup",
      filter,
      options: {
        includeEdited: true,
        downloadFromICloud: true,
        wifiOnly: true,
        includeSharedAlbums: false,
      },
    });
    const secondDone = runToCompletion(engine, second.jobId);
    await vi.runAllTimersAsync();
    const secondReport = await secondDone;

    expect(secondReport.copied).toBe(0);
    expect(secondReport.skippedDuplicate).toBe(firstReport.copied + firstReport.skippedDuplicate);
  });
});
