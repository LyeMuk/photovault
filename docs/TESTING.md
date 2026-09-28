# Testing strategy

See [CONTEXT.md](CONTEXT.md) §14 for the full strategy. This file tracks what actually exists and the
real-device matrix results as they're gathered.

## What runs where

| Suite | Command | Runs locally? |
|---|---|---|
| Web unit (Vitest) | `cd apps/web && npm run test` | Yes — 10 tests passing |
| Web lint/types | `cd apps/web && npm run lint && npm run typecheck` | Yes |
| Web E2E (Playwright, demo mode) | `cd apps/web && npm run test:e2e` | Yes — 9 tests passing (3 iPhone viewport projects × 3 specs, incl. real WebKit for iPhone SE) |
| Swift unit (platform-agnostic) | `cd native/PhotoVaultKit && swift test` | Yes — 26 tests passing (see DECISIONS.md 0002 for the CLT plugin-path fix this needed) |
| Swift unit (PhotoKit/Vision-backed) | same, via CI | No — needs Xcode/iOS SDK (see DECISIONS.md 0002); no such code exists yet |
| XCUITest device flows | `tests/device/` | No — needs Xcode + simulator/device |

## Real-device matrix

Not yet started (Phase 3+ per CONTEXT.md §14). Will be filled in as:

| iPhone model | Connector | iOS version | Drive format | Result | Notes |
|---|---|---|---|---|---|
| _pending_ | | | | | |

## Fault-injection checklist (Phase 2+)

See CONTEXT.md §15 for the full edge-case checklist this maps to. Tracked as tests land, not here.
