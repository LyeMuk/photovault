import { Modal } from "react-bootstrap";
import { IconChevronLeft, IconChevronRight, IconX } from "@tabler/icons-react";
import type { AssetSummary } from "@/plugins/types";
import { thumbnailUrl } from "@/plugins/thumbnailUrl";
import { formatBytes, formatDate } from "@/lib/format";
import { useTranslation } from "react-i18next";

export interface ViewerProps {
  asset: AssetSummary | null;
  onClose: () => void;
  onPrev?: () => void;
  onNext?: () => void;
}

// docs/CONTEXT.md §11.2 Gallery: "a lightbox with a metadata panel". Full-screen,
// swipe/arrow navigation between assets, no image re-encoding — just the thumbnail
// in the web demo (the real app would request a full-size PhotoKit render).
export function Viewer({ asset, onClose, onPrev, onNext }: ViewerProps) {
  const { t } = useTranslation();
  if (!asset) return null;

  return (
    <Modal show fullscreen onHide={onClose} className="bg-dark">
      <div className="d-flex flex-column h-100 bg-dark text-white">
        <div className="d-flex justify-content-end p-2">
          <button
            type="button"
            className="btn btn-link text-white"
            onClick={onClose}
            aria-label={t("common.close")}
          >
            <IconX size={24} />
          </button>
        </div>
        <div className="flex-grow-1 d-flex align-items-center justify-content-center position-relative">
          {onPrev && (
            <button
              type="button"
              className="btn btn-link text-white position-absolute start-0"
              onClick={onPrev}
              aria-label="Previous"
            >
              <IconChevronLeft size={32} />
            </button>
          )}
          <img
            src={thumbnailUrl(asset.localId, 1024)}
            alt=""
            style={{ maxHeight: "70vh", maxWidth: "90vw", objectFit: "contain" }}
          />
          {onNext && (
            <button
              type="button"
              className="btn btn-link text-white position-absolute end-0"
              onClick={onNext}
              aria-label="Next"
            >
              <IconChevronRight size={32} />
            </button>
          )}
        </div>
        <div className="p-3 border-top border-secondary small">
          <div>{formatDate(asset.capturedAtLocal)}</div>
          <div className="text-secondary">
            {asset.widthPx}×{asset.heightPx} · {formatBytes(asset.bytesEstimate)}
            {asset.location?.city && ` · ${asset.location.city}, ${asset.location.country}`}
          </div>
          <div className="text-secondary">{t(`status.${asset.status}`)}</div>
        </div>
      </div>
    </Modal>
  );
}
