import { ListGroup } from "react-bootstrap";
import { Link } from "react-router-dom";
import {
  IconUsers,
  IconMapPin,
  IconListDetails,
  IconSettings,
  IconPalette,
} from "@tabler/icons-react";
import { useTranslation } from "react-i18next";
import { PageHeader } from "@/ui";

const ITEMS = [
  { to: "/more/people", labelKey: "more.people", icon: IconUsers },
  { to: "/more/places", labelKey: "more.places", icon: IconMapPin },
  { to: "/more/jobs", labelKey: "more.jobs", icon: IconListDetails },
  { to: "/more/settings", labelKey: "more.settings", icon: IconSettings },
] as const;

export default function More() {
  const { t } = useTranslation();
  return (
    <div>
      <PageHeader title={t("more.title")} />
      <ListGroup className="mx-3">
        {ITEMS.map(({ to, labelKey, icon: Icon }) => (
          <ListGroup.Item
            key={to}
            action
            as={Link}
            to={to}
            className="d-flex align-items-center gap-3"
          >
            <Icon size={20} />
            {t(labelKey)}
          </ListGroup.Item>
        ))}
        {/* Visible in dev and demo builds per docs/CONTEXT.md §11.1 rule 8 — hide this
            only once a distinct signed-release build target exists. */}
        <ListGroup.Item action as={Link} to="/ui-kit" className="d-flex align-items-center gap-3">
          <IconPalette size={20} />
          {t("more.uiKit")}
        </ListGroup.Item>
      </ListGroup>
    </div>
  );
}
