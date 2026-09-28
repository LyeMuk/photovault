import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button, ListGroup } from "react-bootstrap";
import { useTranslation } from "react-i18next";
import { PageHeader, EmptyState } from "@/ui";
import { Engine } from "@/plugins/engine";
import type { Filter, JobReport } from "@/plugins/types";
import { formatBytes, formatCount } from "@/lib/format";

const PRESETS: { label: string; filter: Filter }[] = [
  { label: "Last 30 days", filter: { scope: "vault", date: { preset: "last_30d" } } },
  { label: "Last 1 year", filter: { scope: "vault", date: { preset: "last_1y" } } },
  { label: "This year", filter: { scope: "vault", date: { preset: "this_year" } } },
];

// Phase 0 scope: presets + preview + a simulated run against the "Photos app"
// destination. Custom filters, Files-folder destination, and the full report UI
// land in Phase 3 alongside the real restore engine (docs/CONTEXT.md §13 Phase 3).
export default function Restore() {
  const { t } = useTranslation();
  const [selected, setSelected] = useState<Filter | null>(null);
  const [jobId, setJobId] = useState<string | null>(null);
  const [report, setReport] = useState<JobReport | null>(null);

  const previewQuery = useQuery({
    queryKey: ["restorePreview", selected],
    queryFn: () => Engine.preview({ kind: "restore", filter: selected! }),
    enabled: selected !== null,
  });

  useEffect(() => {
    const handle = Engine.addListener("jobFinished", (r) => {
      if (r.jobId === jobId) setReport(r);
    });
    return () => void handle.then((h) => h.remove());
  }, [jobId]);

  const runRestore = async () => {
    if (!selected) return;
    const { jobId: id } = await Engine.startJob({
      kind: "restore",
      filter: selected,
      destination: { type: "photos_app" },
    });
    setJobId(id);
  };

  return (
    <div>
      <PageHeader title={t("restore.title")} />
      <div className="px-3">
        <ListGroup className="mb-3">
          {PRESETS.map((preset) => (
            <ListGroup.Item
              key={preset.label}
              action
              active={selected === preset.filter}
              onClick={() => {
                setSelected(preset.filter);
                setReport(null);
                setJobId(null);
              }}
            >
              {preset.label}
            </ListGroup.Item>
          ))}
        </ListGroup>

        {selected && previewQuery.data && (
          <div className="card mb-3">
            <div className="card-body">
              <div className="h4">{formatCount(previewQuery.data.count)} items</div>
              <div className="text-secondary">{formatBytes(previewQuery.data.bytes)}</div>
            </div>
          </div>
        )}

        {selected && previewQuery.data && previewQuery.data.count === 0 && (
          <EmptyState title="Nothing to restore for this preset yet" />
        )}

        {selected && previewQuery.data && previewQuery.data.count > 0 && !report && (
          <Button onClick={runRestore}>Restore to Photos app</Button>
        )}

        {report && (
          <div className="alert alert-success">
            Restored {formatCount(report.restored)} items to the Photos app.
          </div>
        )}
      </div>
    </div>
  );
}
