# apps/mobile/

The Capacitor iOS shell (docs/CONTEXT.md §4.1/§12): `capacitor.config.ts` plus the
generated `ios/` Xcode project.

- **App name:** PhotoVault
- **Bundle id:** `com.lyemuk.photovault` (docs/CONTEXT.md §18's default, resolved —
  see docs/DECISIONS.md)
- **Web assets:** copied from `apps/web/dist` into `ios/App/App/public` by
  `npx cap copy ios` — never edit that folder directly, it's regenerated and
  gitignored.

## Building and running locally

Requires full Xcode (not just Command Line Tools) and its active developer
directory (`xcode-select -p` should print a path under `/Applications/Xcode.app`).

```bash
cd apps/web && npm run build          # produces dist/
cd ../mobile && npx cap copy ios      # syncs dist/ into ios/App/App/public

# Build for the simulator from the CLI:
xcodebuild -project ios/App/App.xcodeproj -scheme App -configuration Debug \
  -destination 'generic/platform=iOS Simulator' build

# Or open the project in Xcode and run it from there:
open ios/App/App.xcodeproj
```

No CocoaPods step is needed — Capacitor plugins resolve via Swift Package Manager
(`ios/App/CapApp-SPM`), which Xcode/`xcodebuild` fetch automatically.

## Current state

There are no native Swift plugins yet (`native/CapacitorPlugins` is empty — see its
README), so every plugin call (`PhotoLibrary`, `Drive`, `Engine`, `Faces`, `Places`)
fails on-device and the UI falls back to its empty states. That's expected for
Phase 0 (docs/CONTEXT.md's own Phase 0 demo milestone is "dashboard empty states",
not working demo data) — the full synthetic demo experience only runs in a browser
(the web build), not inside this native shell. Writing the real PhotoKit-backed
plugins is Phase 1 work.
