import type { ReactNode } from "react";
import { Alert } from "react-bootstrap";
import { useTranslation } from "react-i18next";
import { TopBar } from "./TopBar";
import { TabBar } from "./TabBar";

export interface AppShellProps {
  children: ReactNode;
  driveConnected?: boolean;
  runningJobsCount?: number;
  demoMode?: boolean;
}

// The layout every screen renders inside (docs/CONTEXT.md §11.1 rule 3): TopBar,
// page content, TabBar. Screens must never render their own top/bottom chrome.
export function AppShell({
  children,
  driveConnected = false,
  runningJobsCount = 0,
  demoMode = false,
}: AppShellProps) {
  const { t } = useTranslation();
  return (
    <div className="d-flex flex-column min-vh-100">
      <TopBar driveConnected={driveConnected} runningJobsCount={runningJobsCount} />
      {demoMode && (
        <Alert variant="info" className="pv-demo-banner mb-0 py-2 text-center small">
          {t("app.demoBanner")}
        </Alert>
      )}
      <main className="pv-page-body flex-grow-1">{children}</main>
      <TabBar />
    </div>
  );
}
