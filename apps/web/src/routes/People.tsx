import { useQuery } from "@tanstack/react-query";
import { PageHeader, PersonAvatar, EmptyState } from "@/ui";
import { Faces } from "@/plugins/faces";

// docs/CONTEXT.md §11.2 People screen. Naming/merge/split land once face detection
// itself exists (Phase 5) — the demo has 4 fixed clusters to exercise the UI shape.
export default function People() {
  const { data: people } = useQuery({ queryKey: ["people"], queryFn: () => Faces.listPeople() });

  return (
    <div>
      <PageHeader title="People" />
      {people && people.length > 0 ? (
        <div className="d-flex flex-wrap gap-3 px-3">
          {people.map((person) => (
            <PersonAvatar key={person.id} person={person} />
          ))}
        </div>
      ) : (
        <EmptyState
          title="No people yet"
          description="Face grouping runs on-device once enabled in Settings."
        />
      )}
    </div>
  );
}
