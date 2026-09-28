import { useTranslation } from "react-i18next";
import type { LibrarySummary } from "@/plugins/types";
import { formatBytes, formatCount } from "@/lib/format";

export interface LibraryCardProps {
  summary: LibrarySummary;
  notBackedUpCount: number;
  notBackedUpBytes: number;
}

// docs/CONTEXT.md §11.2 Home screen: library card, e.g. "4,310 not backed up · 21 GB".
export function LibraryCard({ summary, notBackedUpCount, notBackedUpBytes }: LibraryCardProps) {
  const { t } = useTranslation();
  return (
    <div className="card">
      <div className="card-body">
        <h3 className="h5">{t("home.libraryCardTitle")}</h3>
        <div className="text-secondary small mb-1">
          {formatCount(summary.total)} items · {formatBytes(summary.bytesEstimate)}
        </div>
        {notBackedUpCount > 0 ? (
          <div className="text-warning">
            {formatCount(notBackedUpCount)} not backed up · {formatBytes(notBackedUpBytes)}
          </div>
        ) : (
          <div className="text-success">Everything is backed up</div>
        )}
      </div>
    </div>
  );
}
