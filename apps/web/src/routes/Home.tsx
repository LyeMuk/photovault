import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { Button } from "react-bootstrap";
import { useTranslation } from "react-i18next";
import { PageHeader, DriveCard, LibraryCard } from "@/ui";
import { PhotoLibrary } from "@/plugins/photoLibrary";
import { Drive } from "@/plugins/drive";
import { EMPTY_FILTER } from "@/plugins/types";

export default function Home() {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const driveQuery = useQuery({ queryKey: ["drive"], queryFn: () => Drive.getDrive() });
  const summaryQuery = useQuery({
    queryKey: ["librarySummary"],
    queryFn: () => PhotoLibrary.getLibrarySummary(),
  });
  const notBackedUpQuery = useQuery({
    queryKey: ["notBackedUp"],
    queryFn: () =>
      PhotoLibrary.queryAssets({
        filter: { ...EMPTY_FILTER, status: ["not_backed_up"] },
        limit: 1,
        sort: "newest",
      }),
  });

  return (
    <div>
      <PageHeader title={t("home.title")} />
      <div className="px-3 d-flex flex-column gap-3">
        <DriveCard drive={driveQuery.data ?? null} onConnect={() => Drive.pickDrive()} />
        {summaryQuery.data && (
          <LibraryCard
            summary={summaryQuery.data}
            notBackedUpCount={notBackedUpQuery.data?.total ?? 0}
            notBackedUpBytes={notBackedUpQuery.data?.bytes ?? 0}
          />
        )}
        <Button size="lg" variant="primary" onClick={() => navigate("/backup")}>
          {t("home.backupNow")}
        </Button>
      </div>
    </div>
  );
}
