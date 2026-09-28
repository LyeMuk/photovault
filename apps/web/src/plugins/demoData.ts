import type { AssetSummary, BackupStatus, DriveInfo, MediaKind, PlaceNode, Person } from "./types";

// Deterministic PRNG (mulberry32) so the demo looks the same on every load —
// useful for Playwright screenshots and for the user comparing runs.
function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const rand = mulberry32(20260101);
const pick = <T>(arr: readonly T[]): T => arr[Math.floor(rand() * arr.length)];

const PLACES = [
  {
    country: "India",
    countryCode: "IN",
    admin1: "Karnataka",
    city: "Bengaluru",
    lat: 12.9716,
    lon: 77.5946,
  },
  {
    country: "India",
    countryCode: "IN",
    admin1: "Goa",
    city: "Panaji",
    lat: 15.4909,
    lon: 73.8278,
  },
  {
    country: "India",
    countryCode: "IN",
    admin1: "Kerala",
    city: "Kochi",
    lat: 9.9312,
    lon: 76.2673,
  },
  {
    country: "India",
    countryCode: "IN",
    admin1: "Delhi",
    city: "New Delhi",
    lat: 28.6139,
    lon: 77.209,
  },
  {
    country: "India",
    countryCode: "IN",
    admin1: "Maharashtra",
    city: "Mumbai",
    lat: 19.076,
    lon: 72.8777,
  },
  {
    country: "Thailand",
    countryCode: "TH",
    admin1: "Bangkok",
    city: "Bangkok",
    lat: 13.7563,
    lon: 100.5018,
  },
  {
    country: "United Arab Emirates",
    countryCode: "AE",
    admin1: "Dubai",
    city: "Dubai",
    lat: 25.2048,
    lon: 55.2708,
  },
  {
    country: "United States",
    countryCode: "US",
    admin1: "California",
    city: "San Francisco",
    lat: 37.7749,
    lon: -122.4194,
  },
] as const;

const PEOPLE_NAMES = ["Mom", "Arjun", "Priya", "Dadi"] as const;

const KIND_WEIGHTS: [MediaKind, number][] = [
  ["photo", 62],
  ["video", 12],
  ["live", 10],
  ["screenshot", 12],
  ["edited", 4],
];

function weightedKind(): MediaKind {
  const total = KIND_WEIGHTS.reduce((sum, [, w]) => sum + w, 0);
  let r = rand() * total;
  for (const [kind, w] of KIND_WEIGHTS) {
    if (r < w) return kind;
    r -= w;
  }
  return "photo";
}

const TOTAL_ITEMS = 2000;
const YEARS_BACK = 5;
const now = new Date();

function randomCapturedAt(): Date {
  const daysBack = Math.floor(rand() * 365 * YEARS_BACK);
  const d = new Date(now);
  d.setDate(d.getDate() - daysBack);
  d.setHours(Math.floor(rand() * 24), Math.floor(rand() * 60), Math.floor(rand() * 60), 0);
  return d;
}

function buildAssets(): AssetSummary[] {
  const assets: AssetSummary[] = [];
  for (let i = 0; i < TOTAL_ITEMS; i++) {
    const kind = weightedKind();
    const capturedAt = randomCapturedAt();
    const hasGps = rand() > 0.25;
    const place = hasGps ? pick(PLACES) : undefined;
    const status: BackupStatus =
      rand() < 0.55 ? "backed_up" : rand() < 0.9 ? "not_backed_up" : "icloud_only";
    const peopleCount = rand() < 0.55 ? (rand() < 0.7 ? 1 : 2) : 0;
    const peopleIds: string[] = [];
    for (let p = 0; p < peopleCount; p++) {
      const idx = Math.floor(rand() * PEOPLE_NAMES.length);
      const id = `person-${idx}`;
      if (!peopleIds.includes(id)) peopleIds.push(id);
    }
    const isVideo = kind === "video" || kind === "live";
    assets.push({
      localId: `demo-${i.toString(36)}`,
      kind,
      capturedAtLocal: capturedAt.toISOString(),
      dateConfidence: rand() < 0.9 ? "high" : rand() < 0.6 ? "medium" : "low",
      widthPx: isVideo ? 1920 : kind === "screenshot" ? 1170 : 4032,
      heightPx: isVideo ? 1080 : kind === "screenshot" ? 2532 : 3024,
      durationMs: isVideo ? Math.floor(rand() * 60_000) + 1000 : undefined,
      bytesEstimate: isVideo
        ? Math.floor(rand() * 180_000_000) + 8_000_000
        : Math.floor(rand() * 6_000_000) + 800_000,
      status,
      isFavorite: rand() < 0.08,
      location: place
        ? { lat: place.lat, lon: place.lon, city: place.city, country: place.country }
        : undefined,
      peopleIds,
      albumIds: [],
    });
  }
  return assets.sort((a, b) => b.capturedAtLocal.localeCompare(a.capturedAtLocal));
}

export const DEMO_ASSETS: AssetSummary[] = buildAssets();

export const DEMO_PEOPLE: Person[] = PEOPLE_NAMES.map((name, idx) => ({
  id: `person-${idx}`,
  name,
  hidden: false,
  coverFaceThumbId: DEMO_ASSETS.find((a) => a.peopleIds.includes(`person-${idx}`))?.localId ?? null,
  faceCount: DEMO_ASSETS.filter((a) => a.peopleIds.includes(`person-${idx}`)).length,
}));

export const DEMO_DRIVE: DriveInfo = {
  vaultId: "demo-vault-0001",
  name: "Demo SSD",
  format: "exfat",
  isRemovable: true,
  freeBytes: 412 * 1024 ** 3,
  totalBytes: 512 * 1024 ** 3,
  connected: true,
};

export function buildDemoPlaces(): PlaceNode[] {
  const byCountry = new Map<string, PlaceNode>();
  for (const asset of DEMO_ASSETS) {
    if (!asset.location?.country) continue;
    const place = PLACES.find((p) => p.city === asset.location!.city)!;
    let node = byCountry.get(place.countryCode);
    if (!node) {
      node = { countryCode: place.countryCode, country: place.country, count: 0, admin1: [] };
      byCountry.set(place.countryCode, node);
    }
    node.count++;
    let admin1 = node.admin1.find((a) => a.name === place.admin1);
    if (!admin1) {
      admin1 = { name: place.admin1, count: 0, cities: [] };
      node.admin1.push(admin1);
    }
    admin1.count++;
    let city = admin1.cities.find((c) => c.name === place.city);
    if (!city) {
      city = { name: place.city, count: 0 };
      admin1.cities.push(city);
    }
    city.count++;
  }
  return [...byCountry.values()].sort((a, b) => b.count - a.count);
}
