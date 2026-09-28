# PhotoVault

A privacy-first iPhone app that backs up your Photos library onto an external
drive plugged directly into the phone — no laptop, no cloud, no accounts.

- **Nothing leaves your devices.** No photo, thumbnail, face embedding, or
  metadata is ever sent over the network. See [§13 of the spec](docs/CONTEXT.md#10-performance--quality-targets).
- **Exactly one copy of every file**, guaranteed by content hash, however many
  times you run a backup.
- **Filter and restore systematically**: by date, place, person, or device.
- **Free up space safely**: originals are only removed from the phone after
  the drive copy is re-verified byte for byte, and they go to Recently
  Deleted (recoverable).

## Status

🚧 Phase 0 (Foundations) — in progress. See [docs/DEMOS.md](docs/DEMOS.md) for
the live demo link and [docs/CONTEXT.md](docs/CONTEXT.md) for the full build
specification this project follows.

## Repository layout

```
apps/web/       React + TypeScript UI (Tabler/Bootstrap), also builds the web demo
apps/mobile/    Capacitor iOS shell
native/         Swift package (PhotoVaultKit) + Capacitor plugin wrappers
docs/           Specification, decisions, architecture, testing, release notes
```

## Development

Requirements: Node.js 24 LTS, Xcode (for iOS builds), CocoaPods/SwiftPM.

```bash
cd apps/web
npm install
npm run dev       # web UI with mocked native plugins, at http://localhost:5173
npm run build      # production build
npm run test        # unit tests (vitest)
npm run lint         # eslint
```

```bash
cd native/PhotoVaultKit
swift test          # platform-agnostic logic (no Xcode required)
```

## Privacy promise

PhotoVault makes zero outbound network requests except the app update check
and (opt-in) map tiles. There is no backend, no telemetry, and no accounts.

## License

Proprietary — see [LICENSE](LICENSE).
