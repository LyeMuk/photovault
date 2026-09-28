import { IconCircleCheckFilled, IconCloud, IconAlertTriangle } from "@tabler/icons-react";
import type { AssetSummary } from "@/plugins/types";
import { thumbnailUrl } from "@/plugins/thumbnailUrl";

export interface MediaTileProps {
  asset: AssetSummary;
  selected?: boolean;
  onClick?: () => void;
}

const STATUS_ICON: Partial<Record<AssetSummary["status"], typeof IconCircleCheckFilled>> = {
  backed_up: IconCircleCheckFilled,
  icloud_only: IconCloud,
};

// A single gallery cell with its backup-status badge (docs/CONTEXT.md §11.2 Gallery:
// "✅ In Vault, ⬜ Not backed up, ☁️ Cloud-only, ⚠️ Low-confidence date"). Semantic
// colors follow §11.1 rule 5 exactly — success/info/warning, nothing hard-coded.
export function MediaTile({ asset, selected, onClick }: MediaTileProps) {
  const StatusIcon = STATUS_ICON[asset.status];
  const statusColorClass =
    asset.status === "backed_up"
      ? "text-success"
      : asset.status === "icloud_only"
        ? "text-info"
        : "text-white-50";

  return (
    <button
      type="button"
      onClick={onClick}
      className="p-0 border-0 position-relative w-100"
      style={{ aspectRatio: "1 / 1", cursor: "pointer" }}
    >
      <img
        src={thumbnailUrl(asset.localId, 256)}
        alt=""
        className="w-100 h-100"
        style={{ objectFit: "cover", outline: selected ? "3px solid var(--tblr-primary)" : "none" }}
        loading="lazy"
      />
      <span className={`position-absolute top-0 end-0 m-1 ${statusColorClass}`}>
        {StatusIcon && <StatusIcon size={18} />}
      </span>
      {asset.dateConfidence === "low" && (
        <span className="position-absolute bottom-0 start-0 m-1 text-warning">
          <IconAlertTriangle size={16} />
        </span>
      )}
      {asset.durationMs !== undefined && (
        <span className="position-absolute bottom-0 end-0 m-1 badge bg-dark bg-opacity-75">
          {Math.round(asset.durationMs / 1000)}s
        </span>
      )}
    </button>
  );
}
