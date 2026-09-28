import { WebPlugin } from "@capacitor/core";
import type { EnginePlugin } from "./engine";
import { DEMO_ASSETS } from "./demoData";
import { applyFilter } from "./filterAssets";
import type {
  AssetSummary,
  Filter,
  JobReport,
  JobType,
  PreviewResult,
  StartJobRequest,
} from "./types";

const ITEMS_PER_TICK = 40;
const TICK_MS = 120;

interface RunningJob {
  report: JobReport;
  timer: ReturnType<typeof setInterval> | null;
  queue: AssetSummary[];
  index: number;
}

// Simulates the job engine described in docs/CONTEXT.md §7.2/§7.5: it respects the
// one-copy invariant against `backedUpIds` (session-local — a fresh page load resets
// it), so running "Back up" twice in a row shows every item skipped the second time,
// exactly like the real fast path. Delete always runs as a dry-run preview in the web
// demo — nothing is ever actually removed here (per §17.5, "the delete flow runs as a
// dry-run preview").
export class EngineWeb extends WebPlugin implements EnginePlugin {
  private backedUpIds = new Set<string>(
    DEMO_ASSETS.filter((a) => a.status === "backed_up").map((a) => a.localId),
  );
  private jobs = new Map<string, RunningJob>();

  async preview(req: {
    kind: "backup" | "restore" | "delete";
    filter: Filter;
  }): Promise<PreviewResult> {
    const matched = applyFilter(DEMO_ASSETS, req.filter);
    let target: AssetSummary[];
    const warnings: string[] = [];

    if (req.kind === "backup") {
      target = matched.filter((a) => !this.backedUpIds.has(a.localId));
      if (matched.length > 0 && target.length === 0) {
        warnings.push("Everything matching this filter is already on your drive.");
      }
    } else if (req.kind === "restore") {
      target = matched.filter((a) => this.backedUpIds.has(a.localId));
    } else {
      target = matched.filter((a) => this.backedUpIds.has(a.localId));
      const liveCount = target.filter((a) => a.kind === "live").length;
      if (liveCount > 0)
        warnings.push(`${liveCount} are Live Photos — both parts will be removed.`);
      const favCount = target.filter((a) => a.isFavorite).length;
      if (favCount > 0) warnings.push(`${favCount} are favorites.`);
    }

    return {
      count: target.length,
      bytes: target.reduce((sum, a) => sum + a.bytesEstimate, 0),
      dateRange:
        target.length > 0
          ? {
              from: target[target.length - 1].capturedAtLocal,
              to: target[0].capturedAtLocal,
            }
          : undefined,
      sampleThumbnailIds: target.slice(0, 24).map((a) => a.localId),
      warnings,
    };
  }

  async startJob(req: StartJobRequest): Promise<{ jobId: string }> {
    const jobId = crypto.randomUUID();
    const queue = this.buildQueue(req);

    const report: JobReport = {
      jobId,
      type: req.kind as JobType,
      status: "running",
      startedAt: new Date().toISOString(),
      copied: 0,
      skippedDuplicate: 0,
      skippedPreviouslyRemoved: 0,
      restored: 0,
      removed: 0,
      errors: 0,
      bytesMoved: 0,
    };

    const job: RunningJob = { report, timer: null, queue, index: 0 };
    this.jobs.set(jobId, job);
    this.tick(jobId, req.kind);
    return { jobId };
  }

  private buildQueue(req: StartJobRequest): AssetSummary[] {
    if (req.kind === "backup") return applyFilter(DEMO_ASSETS, req.filter);
    if (req.kind === "restore")
      return applyFilter(DEMO_ASSETS, req.filter).filter((a) => this.backedUpIds.has(a.localId));
    if (req.kind === "delete")
      return applyFilter(DEMO_ASSETS, req.filter).filter((a) => this.backedUpIds.has(a.localId));
    return []; // cleanup / reindex / faces: instant no-op jobs in the demo
  }

  private tick(jobId: string, kind: JobType) {
    const job = this.jobs.get(jobId);
    if (!job) return;

    job.timer = setInterval(() => {
      const current = this.jobs.get(jobId);
      if (!current || current.report.status !== "running") return;

      const batch = current.queue.slice(current.index, current.index + ITEMS_PER_TICK);
      if (batch.length === 0) {
        this.finish(jobId);
        return;
      }

      let bytesThisBatch = 0;
      for (const asset of batch) {
        bytesThisBatch += asset.bytesEstimate;
        if (kind === "backup") {
          if (this.backedUpIds.has(asset.localId)) {
            current.report.skippedDuplicate++;
          } else {
            this.backedUpIds.add(asset.localId);
            current.report.copied++;
          }
        } else if (kind === "restore") {
          current.report.restored++;
        } else if (kind === "delete") {
          current.report.removed++;
        }
      }
      current.report.bytesMoved += bytesThisBatch;
      current.index += batch.length;

      const done = current.index;
      const total = current.queue.length;
      this.notifyListeners("jobProgress", {
        jobId,
        done,
        total,
        bytesDone: current.report.bytesMoved,
        bytesTotal: current.queue.reduce((sum, a) => sum + a.bytesEstimate, 0),
        rateBytesPerSec: Math.round(bytesThisBatch / (TICK_MS / 1000)),
        etaSeconds:
          total > 0 ? Math.round(((total - done) / ITEMS_PER_TICK) * (TICK_MS / 1000)) : 0,
        current: batch[batch.length - 1]?.localId,
        copied: current.report.copied,
        skippedDuplicate: current.report.skippedDuplicate,
        waitingForICloud: 0,
        errors: current.report.errors,
      });

      if (current.index >= current.queue.length) {
        this.finish(jobId);
      }
    }, TICK_MS);
  }

  private finish(jobId: string) {
    const job = this.jobs.get(jobId);
    if (!job) return;
    if (job.timer) clearInterval(job.timer);
    job.report.status = "done";
    job.report.finishedAt = new Date().toISOString();
    this.notifyListeners("jobFinished", job.report);
  }

  async pauseJob(jobId: string): Promise<void> {
    const job = this.jobs.get(jobId);
    if (job) job.report.status = "paused";
  }

  async resumeJob(jobId: string): Promise<void> {
    const job = this.jobs.get(jobId);
    if (job && job.report.status === "paused") {
      job.report.status = "running";
    }
  }

  async cancelJob(jobId: string): Promise<void> {
    const job = this.jobs.get(jobId);
    if (!job) return;
    if (job.timer) clearInterval(job.timer);
    job.report.status = "cancelled";
    job.report.finishedAt = new Date().toISOString();
    this.notifyListeners("jobFinished", job.report);
  }

  async listJobs(): Promise<JobReport[]> {
    return [...this.jobs.values()]
      .map((j) => j.report)
      .sort((a, b) => b.startedAt.localeCompare(a.startedAt));
  }

  async getJobReport(jobId: string): Promise<JobReport | null> {
    return this.jobs.get(jobId)?.report ?? null;
  }
}
