# native/CapacitorPlugins/

Thin Capacitor plugin wrappers (docs/CONTEXT.md §4.1) that adapt `PhotoVaultKit`'s
Swift API to the Capacitor bridge contract in CONTEXT.md §4.2 — one wrapper per
`apps/web/src/plugins/*.ts` interface (`PhotoLibraryPlugin`, `DrivePlugin`,
`EnginePlugin`, `FacesPlugin`, `PlacesPlugin`).

Not yet written — added once `apps/mobile/ios` exists (see
[../../apps/mobile/README.md](../../apps/mobile/README.md)) and there's an Xcode
project to register them in.
