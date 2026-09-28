import { useMemo, useState, useEffect } from "react";
import { GroupedVirtuoso } from "react-virtuoso";
import type { AssetSummary } from "@/plugins/types";
import { formatMonthYear } from "@/lib/format";
import { MediaTile } from "./MediaTile";

export interface MediaGridProps {
  assets: AssetSummary[];
  selectedIds?: Set<string>;
  onSelect?: (asset: AssetSummary) => void;
}

function useColumnCount() {
  const [columns, setColumns] = useState(() =>
    typeof window === "undefined"
      ? 3
      : window.innerWidth < 480
        ? 3
        : window.innerWidth < 900
          ? 4
          : 6,
  );
  useEffect(() => {
    const onResize = () =>
      setColumns(window.innerWidth < 480 ? 3 : window.innerWidth < 900 ? 4 : 6);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);
  return columns;
}

function monthKey(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${d.getMonth()}`;
}

// A virtualized grid grouped by month with sticky headers (docs/CONTEXT.md §11.2
// Gallery: "grouped by month with sticky headers... stays smooth" at 100k+ items).
// Assumes `assets` is already sorted newest-first, as every plugin query returns it.
// Uses `useWindowScroll` rather than a fixed-height container: this app has a single
// page-level scroller (AppShell has no independent scroll regions), and threading a
// real pixel height down through several percentage-height flex ancestors is the
// classic way to end up with a silently zero-height, empty-looking virtuoso.
export function MediaGrid({ assets, selectedIds, onSelect }: MediaGridProps) {
  const columns = useColumnCount();

  const { groupCounts, groupLabels, rows } = useMemo(() => {
    const months: { key: string; label: string; assets: AssetSummary[] }[] = [];
    for (const asset of assets) {
      const key = monthKey(asset.capturedAtLocal);
      let group = months[months.length - 1];
      if (!group || group.key !== key) {
        group = { key, label: formatMonthYear(asset.capturedAtLocal), assets: [] };
        months.push(group);
      }
      group.assets.push(asset);
    }
    const counts: number[] = [];
    const labels: string[] = [];
    const allRows: AssetSummary[][] = [];
    for (const group of months) {
      const rowsInGroup = Math.ceil(group.assets.length / columns);
      counts.push(rowsInGroup);
      labels.push(group.label);
      for (let r = 0; r < rowsInGroup; r++) {
        allRows.push(group.assets.slice(r * columns, r * columns + columns));
      }
    }
    return { groupCounts: counts, groupLabels: labels, rows: allRows };
  }, [assets, columns]);

  if (assets.length === 0) return null;

  return (
    <GroupedVirtuoso
      useWindowScroll
      groupCounts={groupCounts}
      groupContent={(index) => (
        <div className="bg-body-tertiary px-3 py-1 small fw-semibold border-bottom">
          {groupLabels[index]}
        </div>
      )}
      itemContent={(index) => (
        <div
          className="d-grid gap-1 px-1 py-1"
          style={{ gridTemplateColumns: `repeat(${columns}, 1fr)` }}
        >
          {rows[index].map((asset) => (
            <MediaTile
              key={asset.localId}
              asset={asset}
              selected={selectedIds?.has(asset.localId)}
              onClick={() => onSelect?.(asset)}
            />
          ))}
        </div>
      )}
    />
  );
}
