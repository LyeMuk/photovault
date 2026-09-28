import { useState } from "react";
import { Button } from "react-bootstrap";
import {
  PageHeader,
  StatCard,
  DriveCard,
  LibraryCard,
  MediaTile,
  JobProgressCard,
  EmptyState,
  ErrorState,
  PersonAvatar,
  PlaceList,
  Wizard,
  ConfirmSheet,
  DangerConfirmSheet,
  FilterSheet,
  useToastStore,
} from "@/ui";
import { DEMO_ASSETS, DEMO_PEOPLE, DEMO_DRIVE, buildDemoPlaces } from "@/plugins/demoData";
import { EMPTY_FILTER, type Filter } from "@/plugins/types";
import { IconPhotoOff } from "@tabler/icons-react";

const sampleAssets = DEMO_ASSETS.slice(0, 6);
const samplePlaces = buildDemoPlaces();

// A living style guide (docs/CONTEXT.md §11.1 rule 8): every shared component,
// rendered in both themes via Bootstrap 5.3's per-element `data-bs-theme` scoping.
// This page is the Playwright visual-regression baseline referenced in ci.yml.
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-5">
      <h2 className="h5 border-bottom pb-2 mb-3">{title}</h2>
      <div className="row g-3">
        <div className="col-md-6" data-bs-theme="light">
          <div className="p-3 bg-body rounded border">{children}</div>
        </div>
        <div className="col-md-6" data-bs-theme="dark">
          <div className="p-3 bg-body rounded border">{children}</div>
        </div>
      </div>
    </section>
  );
}

export default function UiKit() {
  const [confirmShow, setConfirmShow] = useState(false);
  const [dangerShow, setDangerShow] = useState(false);
  const [filterShow, setFilterShow] = useState(false);
  const [filter, setFilter] = useState<Filter>(EMPTY_FILTER);
  const pushToast = useToastStore((s) => s.push);

  return (
    <div className="pb-5">
      <PageHeader title="Component catalogue" subtitle="/ui-kit — dev & demo builds only" />
      <div className="px-3">
        <Section title="StatCard">
          <StatCard label="Backed up" value="18,204" hint="96 GB" />
        </Section>

        <Section title="DriveCard">
          <DriveCard drive={DEMO_DRIVE} onConnect={() => {}} />
        </Section>

        <Section title="LibraryCard">
          <LibraryCard
            summary={{ total: 18204, photos: 15000, videos: 3204, bytesEstimate: 96 * 1024 ** 3 }}
            notBackedUpCount={4310}
            notBackedUpBytes={21 * 1024 ** 3}
          />
        </Section>

        <Section title="MediaTile">
          <div className="d-grid gap-1" style={{ gridTemplateColumns: "repeat(3, 1fr)" }}>
            {sampleAssets.map((a) => (
              <MediaTile key={a.localId} asset={a} />
            ))}
          </div>
        </Section>

        <Section title="JobProgressCard">
          <JobProgressCard
            progress={{
              jobId: "demo",
              done: 340,
              total: 1000,
              bytesDone: 4 * 1024 ** 3,
              bytesTotal: 12 * 1024 ** 3,
              rateBytesPerSec: 18 * 1024 ** 2,
              etaSeconds: 95,
              copied: 320,
              skippedDuplicate: 20,
              waitingForICloud: 2,
              errors: 0,
            }}
          />
        </Section>

        <Section title="EmptyState / ErrorState">
          <EmptyState
            icon={<IconPhotoOff size={32} />}
            title="No items match this filter"
            description="Try widening your filter."
          />
          <div className="mt-3">
            <ErrorState message="Something went wrong reading the drive." onRetry={() => {}} />
          </div>
        </Section>

        <Section title="PersonAvatar">
          <div className="d-flex gap-3">
            {DEMO_PEOPLE.map((p) => (
              <PersonAvatar key={p.id} person={p} />
            ))}
          </div>
        </Section>

        <Section title="PlaceList">
          <PlaceList places={samplePlaces.slice(0, 2)} />
        </Section>

        <Section title="Wizard">
          <Wizard
            activeIndex={1}
            steps={[
              { label: "Sources", content: <div>Step 1 content</div> },
              { label: "Filters", content: <div>Step 2 content</div> },
              { label: "Review", content: <div>Step 3 content</div> },
              { label: "Run", content: <div>Step 4 content</div> },
            ]}
          />
        </Section>

        <Section title="Sheets, dialogs & toasts">
          <div className="d-flex flex-wrap gap-2">
            <Button onClick={() => setConfirmShow(true)}>Open ConfirmSheet</Button>
            <Button variant="danger" onClick={() => setDangerShow(true)}>
              Open DangerConfirmSheet
            </Button>
            <Button variant="outline-secondary" onClick={() => setFilterShow(true)}>
              Open FilterSheet
            </Button>
            <Button
              variant="success"
              onClick={() => pushToast("success", "Copied 1,204 new photos.")}
            >
              Success toast
            </Button>
            <Button
              variant="warning"
              onClick={() => pushToast("warning", "12 items have a low-confidence date.")}
            >
              Warning toast
            </Button>
          </div>
        </Section>
      </div>

      <ConfirmSheet
        show={confirmShow}
        title="Move 42 items to Recycle Bin?"
        body="They can be restored from your Recycle Bin afterwards."
        onConfirm={() => setConfirmShow(false)}
        onCancel={() => setConfirmShow(false)}
      />
      <DangerConfirmSheet
        show={dangerShow}
        title="DELETE 42 items"
        body="This cannot be undone because MTP has no trash."
        requiredPhrase="DELETE 42"
        onConfirm={() => setDangerShow(false)}
        onCancel={() => setDangerShow(false)}
      />
      <FilterSheet
        show={filterShow}
        filter={filter}
        onChange={setFilter}
        onClose={() => setFilterShow(false)}
      />
    </div>
  );
}
