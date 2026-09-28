import { Offcanvas, Form, Button } from "react-bootstrap";
import { useTranslation } from "react-i18next";
import type { Filter, MediaKind, BackupStatus } from "@/plugins/types";

type DatePreset = NonNullable<Filter["date"]>["preset"];

export interface FilterSheetProps {
  show: boolean;
  filter: Filter;
  onChange: (filter: Filter) => void;
  onClose: () => void;
}

const KIND_OPTIONS: MediaKind[] = ["photo", "video", "live", "screenshot", "favorite", "edited"];
const STATUS_OPTIONS: BackupStatus[] = ["backed_up", "not_backed_up", "icloud_only"];
const DATE_PRESETS = [
  { value: "", label: "Any time" },
  { value: "last_30d", label: "Last 30 days" },
  { value: "last_6m", label: "Last 6 months" },
  { value: "last_1y", label: "Last 1 year" },
  { value: "this_year", label: "This year" },
  { value: "last_year", label: "Last year" },
] as const;

// The shared filter editor (docs/CONTEXT.md §11.1 rule 4: "FilterSheet (Offcanvas on
// mobile)"), used from Gallery, the Backup wizard, and Restore. Edits a Filter in
// place and reports it back via onChange — screens own the actual Filter state.
export function FilterSheet({ show, filter, onChange, onClose }: FilterSheetProps) {
  const { t } = useTranslation();

  const toggleKind = (kind: MediaKind) => {
    const current = filter.kind ?? [];
    const next = current.includes(kind) ? current.filter((k) => k !== kind) : [...current, kind];
    onChange({ ...filter, kind: next.length ? next : undefined });
  };

  const toggleStatus = (status: BackupStatus) => {
    const current = filter.status ?? [];
    const next = current.includes(status)
      ? current.filter((s) => s !== status)
      : [...current, status];
    onChange({ ...filter, status: next.length ? next : undefined });
  };

  return (
    <Offcanvas show={show} onHide={onClose} placement="bottom" style={{ height: "75vh" }}>
      <Offcanvas.Header closeButton>
        <Offcanvas.Title>Filter</Offcanvas.Title>
      </Offcanvas.Header>
      <Offcanvas.Body>
        <Form.Group className="mb-3">
          <Form.Label className="fw-semibold">Type</Form.Label>
          <div className="d-flex flex-wrap gap-2">
            {KIND_OPTIONS.map((kind) => (
              <Form.Check
                key={kind}
                type="checkbox"
                id={`kind-${kind}`}
                label={kind}
                checked={filter.kind?.includes(kind) ?? false}
                onChange={() => toggleKind(kind)}
              />
            ))}
          </div>
        </Form.Group>

        <Form.Group className="mb-3">
          <Form.Label className="fw-semibold">Status</Form.Label>
          <div className="d-flex flex-wrap gap-2">
            {STATUS_OPTIONS.map((status) => (
              <Form.Check
                key={status}
                type="checkbox"
                id={`status-${status}`}
                label={t(`status.${status}`)}
                checked={filter.status?.includes(status) ?? false}
                onChange={() => toggleStatus(status)}
              />
            ))}
          </div>
        </Form.Group>

        <Form.Group className="mb-3">
          <Form.Label className="fw-semibold">Date</Form.Label>
          <Form.Select
            value={filter.date?.preset ?? ""}
            onChange={(e) =>
              onChange({
                ...filter,
                date: e.target.value ? { preset: e.target.value as DatePreset } : undefined,
              })
            }
          >
            {DATE_PRESETS.map((p) => (
              <option key={p.value} value={p.value}>
                {p.label}
              </option>
            ))}
          </Form.Select>
        </Form.Group>

        <Button
          variant="outline-secondary"
          size="sm"
          onClick={() => onChange({ scope: filter.scope })}
        >
          Clear filters
        </Button>
      </Offcanvas.Body>
    </Offcanvas>
  );
}
