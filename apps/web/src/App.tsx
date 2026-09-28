import { QueryClient, QueryClientProvider, useQuery } from "@tanstack/react-query";
import { HashRouter, Routes, Route, Outlet } from "react-router-dom";
import { AppShell, Toasts } from "@/ui";
import { Drive } from "@/plugins/drive";
import Home from "@/routes/Home";
import Gallery from "@/routes/Gallery";
import Backup from "@/routes/Backup";
import Restore from "@/routes/Restore";
import More from "@/routes/More";
import People from "@/routes/People";
import Places from "@/routes/Places";
import Jobs from "@/routes/Jobs";
import Settings from "@/routes/Settings";
import UiKit from "@/routes/UiKit";

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 30_000, refetchOnWindowFocus: false } },
});

// The web build always runs in demo mode (there is no real Capacitor native layer to
// swap in yet — see docs/DECISIONS.md 0002). Once native/CapacitorPlugins exists, this
// should read `!Capacitor.isNativePlatform()` instead of being hard-coded.
const DEMO_MODE = true;

function Shell() {
  const { data: drive } = useQuery({ queryKey: ["drive"], queryFn: () => Drive.getDrive() });
  return (
    <AppShell driveConnected={drive?.connected ?? false} demoMode={DEMO_MODE}>
      <Outlet />
    </AppShell>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <HashRouter>
        <Routes>
          <Route element={<Shell />}>
            <Route path="/" element={<Home />} />
            <Route path="/gallery" element={<Gallery />} />
            <Route path="/backup" element={<Backup />} />
            <Route path="/restore" element={<Restore />} />
            <Route path="/more" element={<More />} />
            <Route path="/more/people" element={<People />} />
            <Route path="/more/places" element={<Places />} />
            <Route path="/more/jobs" element={<Jobs />} />
            <Route path="/more/settings" element={<Settings />} />
            <Route path="/ui-kit" element={<UiKit />} />
          </Route>
        </Routes>
      </HashRouter>
      <Toasts />
    </QueryClientProvider>
  );
}
