import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "react-bootstrap";
import { IconFilter, IconPhotoOff } from "@tabler/icons-react";
import { useTranslation } from "react-i18next";
import { PageHeader, MediaGrid, FilterSheet, Viewer, EmptyState } from "@/ui";
import { PhotoLibrary } from "@/plugins/photoLibrary";
import { EMPTY_FILTER, type AssetSummary, type Filter } from "@/plugins/types";

// Loads the whole filtered result in one page for now — the demo library tops out
// at ~2,000 items. Real PhotoVaultKit-backed cursor pagination (queryAssets'
// `nextCursor`) is Phase 1 work, once there's a real 100k-item library to test against.
const PAGE_LIMIT = 5000;

export default function Gallery() {
  const { t } = useTranslation();
  const [filter, setFilter] = useState<Filter>(EMPTY_FILTER);
  const [showFilter, setShowFilter] = useState(false);
  const [viewerAsset, setViewerAsset] = useState<AssetSummary | null>(null);

  const query = useQuery({
    queryKey: ["assets", filter],
    queryFn: () => PhotoLibrary.queryAssets({ filter, limit: PAGE_LIMIT, sort: "newest" }),
  });

  const assets = query.data?.items ?? [];
  const activeFilterCount = useMemo(
    () => Object.values(filter).filter((v) => v !== undefined && v !== "both").length,
    [filter],
  );

  const currentIndex = viewerAsset
    ? assets.findIndex((a) => a.localId === viewerAsset.localId)
    : -1;

  return (
    <div>
      <PageHeader
        title={t("gallery.title")}
        subtitle={query.data ? `${query.data.total} items` : undefined}
        action={
          <Button variant="outline-secondary" size="sm" onClick={() => setShowFilter(true)}>
            <IconFilter size={16} /> {activeFilterCount > 0 ? activeFilterCount : ""}
          </Button>
        }
      />
      {query.isLoading ? (
        <EmptyState title={t("gallery.loading")} />
      ) : assets.length === 0 ? (
        <EmptyState icon={<IconPhotoOff size={40} />} title={t("gallery.empty")} />
      ) : (
        <MediaGrid assets={assets} onSelect={setViewerAsset} />
      )}
      <FilterSheet
        show={showFilter}
        filter={filter}
        onChange={setFilter}
        onClose={() => setShowFilter(false)}
      />
      <Viewer
        asset={viewerAsset}
        onClose={() => setViewerAsset(null)}
        onPrev={currentIndex > 0 ? () => setViewerAsset(assets[currentIndex - 1]) : undefined}
        onNext={
          currentIndex >= 0 && currentIndex < assets.length - 1
            ? () => setViewerAsset(assets[currentIndex + 1])
            : undefined
        }
      />
    </div>
  );
}
