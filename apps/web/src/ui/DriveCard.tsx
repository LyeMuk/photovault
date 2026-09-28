import { Button } from "react-bootstrap";
import { IconDeviceUsb, IconAlertTriangle } from "@tabler/icons-react";
import { useTranslation } from "react-i18next";
import type { DriveInfo } from "@/plugins/types";
import { formatBytes } from "@/lib/format";

export interface DriveCardProps {
  drive: DriveInfo | null;
  onConnect: () => void;
}

// docs/CONTEXT.md §11.2 Home screen: "Vault/Drive card (name, format, free space,
// last backup)". Warns on FAT32 per §5.1.
export function DriveCard({ drive, onConnect }: DriveCardProps) {
  const { t } = useTranslation();

  if (!drive || !drive.connected) {
    return (
      <div className="card">
        <div className="card-body text-center py-4">
          <IconDeviceUsb size={32} className="text-secondary mb-2" />
          <p className="mb-3">{t("home.noDriveConnected")}</p>
          <Button variant="primary" onClick={onConnect}>
            {t("home.connectDrive")}
          </Button>
        </div>
      </div>
    );
  }

  const usedFraction = 1 - drive.freeBytes / drive.totalBytes;

  return (
    <div className="card">
      <div className="card-body">
        <div className="d-flex justify-content-between align-items-center mb-2">
          <h3 className="h5 mb-0">{drive.name}</h3>
          <span className="badge text-bg-secondary text-uppercase">{drive.format}</span>
        </div>
        <div className="progress mb-2" style={{ height: 6 }}>
          <div
            className="progress-bar"
            role="progressbar"
            style={{ width: `${Math.round(usedFraction * 100)}%` }}
          />
        </div>
        <div className="text-secondary small">
          {formatBytes(drive.freeBytes)} free of {formatBytes(drive.totalBytes)}
        </div>
        {drive.format === "fat32" && (
          <div className="text-warning small mt-2 d-flex align-items-center gap-1">
            <IconAlertTriangle size={14} /> FAT32 has a 4 GB file limit — long videos may fail.
          </div>
        )}
      </div>
    </div>
  );
}
