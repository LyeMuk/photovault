import { Accordion } from "react-bootstrap";
import type { PlaceNode } from "@/plugins/types";
import { formatCount } from "@/lib/format";

export interface PlaceListProps {
  places: PlaceNode[];
  onSelectCity?: (countryCode: string, admin1: string, city: string) => void;
}

// docs/CONTEXT.md §11.2 Places screen: Country → State → City list with counts.
export function PlaceList({ places, onSelectCity }: PlaceListProps) {
  return (
    <Accordion alwaysOpen={false}>
      {places.map((country, i) => (
        <Accordion.Item eventKey={String(i)} key={country.countryCode}>
          <Accordion.Header>
            <span className="flex-grow-1">{country.country}</span>
            <span className="badge text-bg-secondary me-2">{formatCount(country.count)}</span>
          </Accordion.Header>
          <Accordion.Body className="p-0">
            <ul className="list-group list-group-flush">
              {country.admin1.map((admin1) => (
                <li key={admin1.name} className="list-group-item">
                  <div className="fw-semibold d-flex justify-content-between">
                    <span>{admin1.name}</span>
                    <span className="text-secondary">{formatCount(admin1.count)}</span>
                  </div>
                  <ul className="list-unstyled ms-3 mb-0 mt-1">
                    {admin1.cities.map((city) => (
                      <li key={city.name}>
                        <button
                          type="button"
                          className="btn btn-link p-0 d-flex justify-content-between w-100 text-decoration-none"
                          onClick={() =>
                            onSelectCity?.(country.countryCode, admin1.name, city.name)
                          }
                        >
                          <span>{city.name}</span>
                          <span className="text-secondary">{formatCount(city.count)}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </li>
              ))}
            </ul>
          </Accordion.Body>
        </Accordion.Item>
      ))}
    </Accordion>
  );
}
