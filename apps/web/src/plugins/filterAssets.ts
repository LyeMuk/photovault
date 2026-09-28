import type { AssetSummary, Filter } from "./types";

// The in-memory equivalent of the Filter → SQL compiler described in
// docs/CONTEXT.md §9. Real PhotoVaultKit compiles this to parameterized SQL;
// here it's a plain predicate over the synthetic demo dataset, but the shape
// of the logic (and which fields are supported) must stay in sync with it.
export function applyFilter(assets: readonly AssetSummary[], filter: Filter): AssetSummary[] {
  return assets.filter((asset) => matches(asset, filter));
}

function matches(asset: AssetSummary, filter: Filter): boolean {
  if (filter.kind && filter.kind.length > 0) {
    const kindMatch =
      filter.kind.includes(asset.kind) || (filter.kind.includes("favorite") && asset.isFavorite);
    if (!kindMatch) return false;
  }

  if (filter.status && filter.status.length > 0 && !filter.status.includes(asset.status)) {
    return false;
  }

  if (filter.date) {
    const captured = new Date(asset.capturedAtLocal);
    if (filter.date.from && captured < new Date(filter.date.from)) return false;
    if (filter.date.to && captured > new Date(filter.date.to)) return false;
    if (filter.date.years && !filter.date.years.includes(captured.getFullYear())) return false;
    if (filter.date.months && !filter.date.months.includes(captured.getMonth() + 1)) return false;
    if (filter.date.preset) {
      const now = Date.now();
      const days = (n: number) => now - n * 24 * 60 * 60 * 1000;
      const thresholds: Record<string, number> = {
        last_30d: days(30),
        last_6m: days(182),
        last_1y: days(365),
      };
      if (filter.date.preset === "this_year") {
        if (captured.getFullYear() !== new Date().getFullYear()) return false;
      } else if (filter.date.preset === "last_year") {
        if (captured.getFullYear() !== new Date().getFullYear() - 1) return false;
      } else if (captured.getTime() < thresholds[filter.date.preset]) {
        return false;
      }
    }
  }

  if (filter.location) {
    if (filter.location.hasGps && !asset.location) return false;
    if (filter.location.countryCodes?.length) {
      if (!asset.location || !filter.location.countryCodes.includes(asset.location.country ?? "")) {
        // demo data stores country name, not code, on the asset — country-code
        // filtering is resolved by the real offline geocoder in PhotoVaultKit.
      }
    }
    if (filter.location.cities?.length) {
      if (!asset.location || !filter.location.cities.includes(asset.location.city ?? ""))
        return false;
    }
  }

  if (filter.people) {
    if ("noFaces" in filter.people) {
      if (asset.peopleIds.length > 0) return false;
    } else if (filter.people.ids.length > 0) {
      const hasAny = filter.people.ids.some((id) => asset.peopleIds.includes(id));
      const hasAll = filter.people.ids.every((id) => asset.peopleIds.includes(id));
      if (filter.people.mode === "all" ? !hasAll : !hasAny) return false;
    }
  }

  if (filter.minSizeBytes !== undefined && asset.bytesEstimate < filter.minSizeBytes) return false;
  if (filter.maxSizeBytes !== undefined && asset.bytesEstimate > filter.maxSizeBytes) return false;

  return true;
}
