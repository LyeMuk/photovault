import { useQuery } from "@tanstack/react-query";
import { ListGroup, Badge } from "react-bootstrap";
import { PageHeader, EmptyState } from "@/ui";
import { Engine } from "@/plugins/engine";
import { formatBytes, formatCount } from "@/lib/format";

const STATUS_VARIANT: Record<string, string> = {
  done: "success",
  running: "info",
  paused: "warning",
  failed: "danger",
  cancelled: "secondary",
  queued: "secondary",
};

export default function Jobs() {
  const { data: jobs } = useQuery({
    queryKey: ["jobs"],
    queryFn: () => Engine.listJobs(),
    refetchInterval: 1000,
  });

  return (
    <div>
      <PageHeader title="Jobs & logs" />
      <div className="px-3">
        {jobs && jobs.length > 0 ? (
          <ListGroup>
            {jobs.map((job) => (
              <ListGroup.Item
                key={job.jobId}
                className="d-flex justify-content-between align-items-center"
              >
                <div>
                  <div className="text-capitalize fw-semibold">{job.type}</div>
                  <div className="text-secondary small">
                    {formatCount(job.copied)} copied · {formatCount(job.skippedDuplicate)} skipped ·{" "}
                    {formatBytes(job.bytesMoved)}
                  </div>
                </div>
                <Badge bg={STATUS_VARIANT[job.status]}>{job.status}</Badge>
              </ListGroup.Item>
            ))}
          </ListGroup>
        ) : (
          <EmptyState
            title="No jobs yet"
            description="Backup, restore, and cleanup jobs will show up here."
          />
        )}
      </div>
    </div>
  );
}
