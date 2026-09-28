# Architecture

See [CONTEXT.md](CONTEXT.md) §4 for the full architecture diagram and tech stack — this file tracks
how the repository actually implements it, updated as phases land.

## Layers

- **`apps/web`** — React + TypeScript UI. Talks to native functionality only through the plugin
  interfaces in `apps/web/src/plugins/*.ts`. Never imports a native SDK directly.
- **`apps/web/src/plugins/*.web.ts`** — mock (web) implementations of those same interfaces, backed by
  synthetic data (`apps/web/src/plugins/demoData.ts`). These are what runs in the browser demo and in
  Vitest/Playwright, and are what `apps/mobile`'s Capacitor bridge will be swapped in for once the iOS
  plugins exist.
- **`native/PhotoVaultKit`** — the Swift package with all photo/drive/index/face logic, split so that
  platform-agnostic pieces (models, path templating, date resolution, the filter→SQL compiler, the GRDB
  schema) have no iOS-only imports and are testable with plain `swift test` on macOS. PhotoKit/Vision/
  Core ML-backed pieces live behind protocols so they can be faked in tests.
- **`native/CapacitorPlugins`** — thin Capacitor plugin wrappers that adapt `PhotoVaultKit`'s Swift API
  to the Capacitor bridge contract in §4.2 of CONTEXT.md. Added once `apps/mobile/ios` exists (blocked
  on Xcode — see DECISIONS.md 0002).

## Data flow (backup)

```
Gallery (React) → plugins/engine.ts.preview(filter) → EnginePlugin (Swift) → IndexStore query → count+bytes
Gallery (React) → plugins/engine.ts.startJob({kind:'backup', filter}) → EnginePlugin
  → for each asset: PhotoLibraryPlugin.export → CryptoKit hash → IndexStore commit → 'jobProgress' event
  → React subscribes to the event stream via the same plugin interface
```

The web mock implementations replay this same event shape from an in-memory synthetic job, so UI code
written against the interface behaves identically in the demo and the real app.
