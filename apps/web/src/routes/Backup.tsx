import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button, Form } from "react-bootstrap";
import { useTranslation } from "react-i18next";
import { PageHeader, Wizard, JobProgressCard, useToastStore, type WizardStep } from "@/ui";
import { Engine } from "@/plugins/engine";
import { EMPTY_FILTER, type Filter, type JobProgress, type JobReport } from "@/plugins/types";
import { formatBytes, formatCount } from "@/lib/format";

const STEP_LABELS = ["What", "Options", "Review", "Run"];

export default function Backup() {
  const { t } = useTranslation();
  const pushToast = useToastStore((s) => s.push);
  const [stepIndex, setStepIndex] = useState(0);
  const [filter, setFilter] = useState<Filter>({ ...EMPTY_FILTER, status: ["not_backed_up"] });
  const [options, setOptions] = useState({
    includeEdited: true,
    downloadFromICloud: true,
    wifiOnly: true,
    includeSharedAlbums: false,
  });
  const [jobId, setJobId] = useState<string | null>(null);
  const [progress, setProgress] = useState<JobProgress | null>(null);
  const [report, setReport] = useState<JobReport | null>(null);

  const previewQuery = useQuery({
    queryKey: ["backupPreview", filter],
    queryFn: () => Engine.preview({ kind: "backup", filter }),
    enabled: stepIndex >= 2,
  });

  useEffect(() => {
    const progressHandle = Engine.addListener("jobProgress", (p) => {
      if (p.jobId === jobId) setProgress(p);
    });
    const finishedHandle = Engine.addListener("jobFinished", (r) => {
      if (r.jobId === jobId) {
        setReport(r);
        pushToast(
          "success",
          `Copied ${formatCount(r.copied)}. Skipped ${formatCount(r.skippedDuplicate)} you already had.`,
        );
      }
    });
    return () => {
      void progressHandle.then((h) => h.remove());
      void finishedHandle.then((h) => h.remove());
    };
  }, [jobId, pushToast]);

  const startBackup = async () => {
    setStepIndex(3);
    const { jobId: id } = await Engine.startJob({ kind: "backup", filter, options });
    setJobId(id);
  };

  const steps: WizardStep[] = [
    {
      label: STEP_LABELS[0],
      content: (
        <div>
          <Form.Check
            type="radio"
            name="what"
            id="what-not-backed-up"
            label="Not backed up yet"
            checked={filter.status?.includes("not_backed_up") ?? false}
            onChange={() => setFilter({ ...EMPTY_FILTER, status: ["not_backed_up"] })}
          />
          <Form.Check
            type="radio"
            name="what"
            id="what-all"
            label="Everything"
            checked={!filter.status}
            onChange={() => setFilter({ ...EMPTY_FILTER })}
          />
          <Button className="mt-3" onClick={() => setStepIndex(1)}>
            {t("common.next")}
          </Button>
        </div>
      ),
    },
    {
      label: STEP_LABELS[1],
      content: (
        <div>
          <Form.Check
            type="switch"
            id="opt-edited"
            label="Include edited versions"
            checked={options.includeEdited}
            onChange={(e) => setOptions({ ...options, includeEdited: e.target.checked })}
          />
          <Form.Check
            type="switch"
            id="opt-icloud"
            label="Download originals from iCloud when needed"
            checked={options.downloadFromICloud}
            onChange={(e) => setOptions({ ...options, downloadFromICloud: e.target.checked })}
          />
          <Form.Check
            type="switch"
            id="opt-wifi"
            label="Wi-Fi only"
            checked={options.wifiOnly}
            onChange={(e) => setOptions({ ...options, wifiOnly: e.target.checked })}
          />
          <Form.Check
            type="switch"
            id="opt-shared"
            label="Include shared albums"
            checked={options.includeSharedAlbums}
            onChange={(e) => setOptions({ ...options, includeSharedAlbums: e.target.checked })}
          />
          <Button className="mt-3" onClick={() => setStepIndex(2)}>
            {t("common.next")}
          </Button>
        </div>
      ),
    },
    {
      label: STEP_LABELS[2],
      content: (
        <div>
          {previewQuery.data && (
            <div className="card mb-3">
              <div className="card-body">
                <div className="h4">{formatCount(previewQuery.data.count)} items</div>
                <div className="text-secondary">{formatBytes(previewQuery.data.bytes)}</div>
                {previewQuery.data.warnings.map((w) => (
                  <div key={w} className="text-warning small mt-1">
                    {w}
                  </div>
                ))}
              </div>
            </div>
          )}
          <Button
            onClick={startBackup}
            disabled={!previewQuery.data || previewQuery.data.count === 0}
          >
            {t("backup.start")}
          </Button>
        </div>
      ),
    },
    {
      label: STEP_LABELS[3],
      content: (
        <div>
          {progress && <JobProgressCard progress={progress} />}
          {report && (
            <div className="alert alert-success mt-3">
              {t("backup.copied", { count: report.copied })}.{" "}
              {t("backup.skipped", { count: report.skippedDuplicate })}.
            </div>
          )}
        </div>
      ),
    },
  ];

  return (
    <div>
      <PageHeader title={t("backup.title")} />
      <div className="px-3">
        <Wizard steps={steps} activeIndex={stepIndex} />
      </div>
    </div>
  );
}
