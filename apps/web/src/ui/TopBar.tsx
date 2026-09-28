import type { ReactNode } from "react";
import { Badge } from "react-bootstrap";
import { IconDeviceUsb } from "@tabler/icons-react";
import { useTranslation } from "react-i18next";

export interface TopBarProps {
  driveConnected: boolean;
  runningJobsCount?: number;
  right?: ReactNode;
}

// The persistent top bar (docs/CONTEXT.md §11.1 rule 3): title, drive status chip,
// running-job indicator. Present on every screen via AppShell.
export function TopBar({ driveConnected, runningJobsCount = 0, right }: TopBarProps) {
  const { t } = useTranslation();
  return (
    <header className="pv-top-bar navbar navbar-expand bg-body border-bottom px-3 py-2 d-flex align-items-center">
      <span className="navbar-brand fw-bold mb-0 me-auto">{t("app.name")}</span>
      <span
        className={`badge d-inline-flex align-items-center gap-1 me-2 ${driveConnected ? "text-bg-success" : "text-bg-secondary"}`}
      >
        <IconDeviceUsb size={14} stroke={2} />
        {driveConnected ? "Connected" : "No drive"}
      </span>
      {runningJobsCount > 0 && (
        <Badge bg="info" className="me-2">
          {runningJobsCount} running
        </Badge>
      )}
      {right}
    </header>
  );
}
