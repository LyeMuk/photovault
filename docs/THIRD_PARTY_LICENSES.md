# Third-party licenses

Pin exact versions here as they're added. All entries must be permissive (MIT/Apache-2.0/BSD) —
see CONTEXT.md §4.1's licensing rule (no InsightFace/ArcFace weights).

## JavaScript / npm (`apps/web`)

| Package | Version | License |
|---|---|---|
| `@tabler/core` | pinned in `apps/web/package.json` | MIT |
| `react-bootstrap` | pinned in `apps/web/package.json` | MIT |
| `@tabler/icons-react` | pinned in `apps/web/package.json` | MIT |
| `react`, `react-dom` | pinned in `apps/web/package.json` | MIT |
| `react-router-dom` | pinned in `apps/web/package.json` | MIT |
| `@tanstack/react-query` | pinned in `apps/web/package.json` | MIT |
| `zustand` | pinned in `apps/web/package.json` | MIT |
| `react-virtuoso` | pinned in `apps/web/package.json` | MIT |
| `i18next`, `react-i18next` | pinned in `apps/web/package.json` | MIT |
| `sass` | pinned in `apps/web/package.json` (dev) | MIT |
| `vite` | pinned in `apps/web/package.json` (dev) | MIT |

## Swift Package (`native/PhotoVaultKit`)

| Package | Version | License |
|---|---|---|
| `GRDB.swift` | pinned in `Package.swift` | MIT |

## Models (fetched, not committed)

| Model | Source | License |
|---|---|---|
| SFace face embedding | OpenCV Zoo, converted to Core ML | Apache-2.0 |

## Data (fetched, not committed)

| Dataset | Source | License |
|---|---|---|
| GeoNames `cities500` / admin1 / country info | geonames.org | CC BY 4.0 |
