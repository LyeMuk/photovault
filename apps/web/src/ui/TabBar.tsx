import { NavLink } from "react-router-dom";
import {
  IconHome2,
  IconPhoto,
  IconCloudUpload,
  IconDownload,
  IconMenu2,
} from "@tabler/icons-react";
import { useTranslation } from "react-i18next";

const TABS = [
  { to: "/", labelKey: "nav.home", icon: IconHome2, end: true },
  { to: "/gallery", labelKey: "nav.gallery", icon: IconPhoto, end: false },
  { to: "/backup", labelKey: "nav.backup", icon: IconCloudUpload, end: false },
  { to: "/restore", labelKey: "nav.restore", icon: IconDownload, end: false },
  { to: "/more", labelKey: "nav.more", icon: IconMenu2, end: false },
] as const;

// The bottom tab bar (docs/CONTEXT.md §11.1 rule 3 / §11.2): Home · Gallery · Backup ·
// Restore · More. Fixed to the viewport bottom, safe-area aware (see overrides.scss).
export function TabBar() {
  const { t } = useTranslation();
  return (
    <nav className="pv-tab-bar position-fixed bottom-0 start-0 end-0 bg-body border-top d-flex">
      {TABS.map(({ to, labelKey, icon: Icon, end }) => (
        <NavLink
          key={to}
          to={to}
          end={end}
          className={({ isActive }) =>
            `flex-fill d-flex flex-column align-items-center justify-content-center text-decoration-none py-1 ${
              isActive ? "text-primary" : "text-secondary"
            }`
          }
        >
          <Icon size={22} stroke={1.75} />
          <span style={{ fontSize: "0.7rem" }}>{t(labelKey)}</span>
        </NavLink>
      ))}
    </nav>
  );
}
