import { registerPlugin } from "@capacitor/core";
import type { PluginListenerHandle } from "@capacitor/core";
import type { JobItemError, JobProgress, JobReport, PreviewResult, StartJobRequest } from "./types";

export interface EnginePlugin {
  preview(req: {
    kind: "backup" | "restore" | "delete";
    filter: import("./types").Filter;
  }): Promise<PreviewResult>;
  startJob(req: StartJobRequest): Promise<{ jobId: string }>;
  pauseJob(jobId: string): Promise<void>;
  resumeJob(jobId: string): Promise<void>;
  cancelJob(jobId: string): Promise<void>;
  listJobs(): Promise<JobReport[]>;
  getJobReport(jobId: string): Promise<JobReport | null>;

  addListener(
    eventName: "jobProgress",
    listenerFunc: (event: JobProgress) => void,
  ): Promise<PluginListenerHandle>;
  addListener(
    eventName: "jobItemError",
    listenerFunc: (event: JobItemError) => void,
  ): Promise<PluginListenerHandle>;
  addListener(
    eventName: "jobFinished",
    listenerFunc: (event: JobReport) => void,
  ): Promise<PluginListenerHandle>;
  removeAllListeners(): Promise<void>;
}

export const Engine = registerPlugin<EnginePlugin>("Engine", {
  web: () => import("./engine.web").then((m) => new m.EngineWeb()),
});
