import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { Alert, Button } from "react-bootstrap";
import { useTranslation } from "react-i18next";
import { PageHeader, DriveCard, LibraryCard } from "@/ui";
import { PhotoLibrary } from "@/plugins/photoLibrary";
import { Drive } from "@/plugins/drive";
import { EMPTY_FILTER } from "@/plugins/types";

export default function Home() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // docs/CONTEXT.md §3/§11.2: request access up front, on Home — the closest
  // thing to onboarding until a dedicated first-run flow exists (Phase 1+).
  const authQuery = useQuery({
    queryKey: ["photoAuth"],
    queryFn: () => PhotoLibrary.requestAuthorization(),
  });

  // docs/CONTEXT.md §7.1: keeps PhotoVaultKit's IndexStore (library_assets +
  // last_change_token) current. Silent/background — nothing in this screen
  // depends on its result, it just needs to run.
  useQuery({
    queryKey: ["librarySync"],
    queryFn: () => PhotoLibrary.syncLibrary(),
    enabled: authQuery.isSuccess,
    staleTime: 0,
  });

  const driveQuery = useQuery({ queryKey: ["drive"], queryFn: () => Drive.getDrive() });
  const summaryQuery = useQuery({
    queryKey: ["librarySummary"],
    queryFn: () => PhotoLibrary.getLibrarySummary(),
    enabled: authQuery.isSuccess,
  });
  const notBackedUpQuery = useQuery({
    queryKey: ["notBackedUp"],
    queryFn: () =>
      PhotoLibrary.queryAssets({
        filter: { ...EMPTY_FILTER, status: ["not_backed_up"] },
        limit: 1,
        sort: "newest",
      }),
    enabled: authQuery.isSuccess,
  });

  const reviewSelection = async () => {
    await PhotoLibrary.presentLimitedLibraryPicker();
    queryClient.invalidateQueries({ queryKey: ["librarySummary"] });
    queryClient.invalidateQueries({ queryKey: ["notBackedUp"] });
  };

  return (
    <div>
      <PageHeader title={t("home.title")} />
      <div className="px-3 d-flex flex-column gap-3">
        {authQuery.data?.status === "denied" && (
          <Alert variant="warning" className="mb-0">
            Photo access is off, so PhotoVault can't see your library. Turn it on in Settings
            &rsaquo; PhotoVault &rsaquo; Photos.
          </Alert>
        )}
        {authQuery.data?.status === "limited" && (
          <Alert variant="info" className="mb-0 d-flex justify-content-between align-items-center">
            <span>You've given PhotoVault access to a selected few photos.</span>
            <Button size="sm" variant="outline-info" onClick={reviewSelection}>
              Choose more
            </Button>
          </Alert>
        )}

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
