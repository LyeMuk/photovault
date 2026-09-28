import { describe, expect, it } from "vitest";
import { applyFilter } from "../filterAssets";
import type { AssetSummary } from "../types";

function asset(overrides: Partial<AssetSummary>): AssetSummary {
  return {
    localId: "a1",
    kind: "photo",
    capturedAtLocal: "2024-06-15T10:00:00.000Z",
    dateConfidence: "high",
    widthPx: 4032,
    heightPx: 3024,
    bytesEstimate: 2_000_000,
    status: "not_backed_up",
    isFavorite: false,
    peopleIds: [],
    albumIds: [],
    ...overrides,
  };
}

describe("applyFilter", () => {
  it("filters by kind, including the synthetic 'favorite' kind", () => {
    const assets = [
      asset({ localId: "photo", kind: "photo" }),
      asset({ localId: "video", kind: "video" }),
      asset({ localId: "fav", isFavorite: true }),
    ];
    expect(applyFilter(assets, { scope: "both", kind: ["video"] }).map((a) => a.localId)).toEqual([
      "video",
    ]);
    expect(
      applyFilter(assets, { scope: "both", kind: ["favorite"] }).map((a) => a.localId),
    ).toEqual(["fav"]);
  });

  it("filters by backup status", () => {
    const assets = [
      asset({ localId: "in", status: "backed_up" }),
      asset({ localId: "out", status: "not_backed_up" }),
    ];
    expect(
      applyFilter(assets, { scope: "both", status: ["backed_up"] }).map((a) => a.localId),
    ).toEqual(["in"]);
  });

  it("filters by explicit date range, inclusive", () => {
    const assets = [
      asset({ localId: "before", capturedAtLocal: "2023-01-01T00:00:00.000Z" }),
      asset({ localId: "in-range", capturedAtLocal: "2024-01-01T00:00:00.000Z" }),
      asset({ localId: "after", capturedAtLocal: "2025-01-01T00:00:00.000Z" }),
    ];
    const result = applyFilter(assets, {
      scope: "both",
      date: { from: "2023-06-01T00:00:00.000Z", to: "2024-06-01T00:00:00.000Z" },
    });
    expect(result.map((a) => a.localId)).toEqual(["in-range"]);
  });

  it("filters by month across years (e.g. every December)", () => {
    const assets = [
      asset({ localId: "dec-2022", capturedAtLocal: "2022-12-25T00:00:00.000Z" }),
      asset({ localId: "dec-2023", capturedAtLocal: "2023-12-25T00:00:00.000Z" }),
      asset({ localId: "jan-2023", capturedAtLocal: "2023-01-25T00:00:00.000Z" }),
    ];
    const result = applyFilter(assets, { scope: "both", date: { months: [12] } });
    expect(result.map((a) => a.localId).sort()).toEqual(["dec-2022", "dec-2023"]);
  });

  it("filters people with 'any' vs 'all' mode", () => {
    const assets = [
      asset({ localId: "both", peopleIds: ["mom", "arjun"] }),
      asset({ localId: "mom-only", peopleIds: ["mom"] }),
      asset({ localId: "neither", peopleIds: [] }),
    ];
    expect(
      applyFilter(assets, { scope: "both", people: { ids: ["mom", "arjun"], mode: "any" } }).map(
        (a) => a.localId,
      ),
    ).toEqual(["both", "mom-only"]);
    expect(
      applyFilter(assets, { scope: "both", people: { ids: ["mom", "arjun"], mode: "all" } }).map(
        (a) => a.localId,
      ),
    ).toEqual(["both"]);
  });

  it("filters assets with no faces at all via noFaces", () => {
    const assets = [
      asset({ localId: "has-face", peopleIds: ["mom"] }),
      asset({ localId: "no-face", peopleIds: [] }),
    ];
    expect(
      applyFilter(assets, { scope: "both", people: { noFaces: true } }).map((a) => a.localId),
    ).toEqual(["no-face"]);
  });

  it("filters by size bounds", () => {
    const assets = [
      asset({ localId: "small", bytesEstimate: 500_000 }),
      asset({ localId: "big", bytesEstimate: 5_000_000 }),
    ];
    expect(
      applyFilter(assets, { scope: "both", minSizeBytes: 1_000_000 }).map((a) => a.localId),
    ).toEqual(["big"]);
  });
});
