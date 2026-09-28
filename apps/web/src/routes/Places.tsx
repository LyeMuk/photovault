import { useQuery } from "@tanstack/react-query";
import { PageHeader, PlaceList, EmptyState } from "@/ui";
import { Places as PlacesPlugin } from "@/plugins/places";

export default function Places() {
  const { data: places } = useQuery({
    queryKey: ["places"],
    queryFn: () => PlacesPlugin.listPlaces(),
  });

  return (
    <div>
      <PageHeader title="Places" />
      <div className="px-3">
        {places && places.length > 0 ? (
          <PlaceList places={places} />
        ) : (
          <EmptyState
            title="No places yet"
            description="Location data appears once items with GPS are backed up."
          />
        )}
      </div>
    </div>
  );
}
