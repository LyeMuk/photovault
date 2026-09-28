import { ProgressBar } from "react-bootstrap";
import type { JobProgress } from "@/plugins/types";
import { formatBytes, formatCount } from "@/lib/format";

export interface JobProgressCardProps {
  progress: JobProgress;
}

// docs/CONTEXT.md §11.2 Backup wizard "Run" step: progress, pause/cancel, live
// counters (copied / skipped duplicates / errors).
export function JobProgressCard({ progress }: JobProgressCardProps) {
  const pct = progress.total > 0 ? Math.round((progress.done / progress.total) * 100) : 0;
  return (
    <div className="card">
      <div className="card-body">
        <div className="d-flex justify-content-between small text-secondary mb-1">
          <span>
            {formatCount(progress.done)} / {formatCount(progress.total)}
          </span>
          <span>{formatBytes(progress.rateBytesPerSec)}/s</span>
        </div>
        <ProgressBar now={pct} className="mb-2" />
        <div className="row text-center small g-2">
          <div className="col">
            <div className="text-success fw-bold">{formatCount(progress.copied)}</div>
            <div className="text-secondary">Copied</div>
          </div>
          <div className="col">
            <div className="text-secondary fw-bold">{formatCount(progress.skippedDuplicate)}</div>
            <div className="text-secondary">Skipped</div>
          </div>
          <div className="col">
            <div className="text-info fw-bold">{formatCount(progress.waitingForICloud)}</div>
            <div className="text-secondary">iCloud</div>
          </div>
          <div className="col">
            <div className="text-danger fw-bold">{formatCount(progress.errors)}</div>
            <div className="text-secondary">Errors</div>
          </div>
        </div>
        {progress.etaSeconds !== null && (
          <div className="text-secondary small mt-2">ETA {progress.etaSeconds}s</div>
        )}
      </div>
    </div>
  );
}
