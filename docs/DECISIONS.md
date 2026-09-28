# Decisions (ADR log)

Format: Context → Decision → Consequences. Append-only; never edit past entries except to add a follow-up note.

---

## 0001 — Toolchain installed without Homebrew/sudo

**Context:** The build machine had no Homebrew, Rust, Node, or `gh` installed, and only Xcode Command Line
Tools (no full Xcode). The standard Homebrew installer requires `sudo` to create/chown `/opt/homebrew`,
and this session has no way to supply an interactive sudo password.

**Decision:** Installed Node.js 24 LTS ("Krypton") and the GitHub CLI as direct, checksum-verified
binary downloads into `~/.local`, added to `PATH` via `~/.zshrc`. No Homebrew was installed. A Rust
toolchain (`rustup`) was also installed early in the session (from an earlier, since-replaced desktop
spec) but is unused by this iOS-only spec and left in place harmlessly.

**Consequences:** Toolchain is user-space only (no sudo, no system-wide package manager). Future
dependencies (e.g. CocoaPods, swiftlint, swiftformat) should be installed the same way (direct binary /
Mint / SwiftPM plugin) unless the user opts into installing Homebrew themselves.

---

## 0002 — Full Xcode not installed; Phase 0 native code is written and locally tested, but not built as an app

**Context:** Full Xcode (required for `xcodebuild`, the iOS Simulator, and Capacitor's `ios` platform)
is not installed on the build machine — only Command Line Tools, which include a Swift 6.4 toolchain.

Getting `swift test` working under CLT-only took two fixes, recorded here since they're non-obvious:
1. `XCTest.framework` is genuinely Xcode-only — it doesn't exist under CLT at all. Switched
   `PhotoVaultKitTests` from `XCTest` to **Swift Testing** (`import Testing`, `@Test`/`#expect`),
   which is bundled with the toolchain itself rather than Xcode.
2. Even so, plain `swift test` failed with "plugin for module 'TestingMacros' not found" — the
   `libTestingMacros.dylib` plugin exists under CLT
   (`/Library/Developer/CommandLineTools/usr/lib/swift/host/plugins/testing/`) but SwiftPM doesn't
   auto-discover it there the way it does under a full Xcode toolchain. Fixed by adding
   `swiftSettings: [.unsafeFlags(["-plugin-path", ".../plugins/testing"])]` to the test target in
   `Package.swift`. This is harmless once Xcode is installed (the flag just points at an extra,
   unused search path) and does not affect CI, which runs on `macos-latest` GitHub Actions runners
   with full Xcode already.

**Decision:** The user will install Xcode themselves (App Store, tied to their Apple ID) and confirm
when ready. Until then:
- `native/PhotoVaultKit`'s platform-agnostic logic (path templating, date resolution, the `Filter` →
  SQL compiler, the full GRDB schema/migrations including a `v_assets` view unifying `library_assets`
  and `files`) has no iOS-only imports and both **builds and tests pass locally** with `swift build` /
  `swift test` — 26 tests, all green, including a real in-memory SQLite DB exercising the
  `files.sha256 UNIQUE` one-copy invariant.
- iOS-only plugin code (PhotoKit, Vision, Core ML) is not yet written — there's nothing to test
  locally for it either way, since even with the plugin-path fix, CLT still lacks the iOS SDK
  frameworks themselves. That code will only be verified in CI once written.
- `apps/mobile` (the Capacitor iOS project, i.e. `npx cap add ios`) is **not** generated yet — it
  requires Xcode to be present to configure signing and open the workspace correctly. This is the
  first task once Xcode is confirmed installed.

**Consequences:** Phase 0's exit criteria ("the TestFlight build installs") cannot be fully met until
(a) Xcode is installed locally or CI is used for the first `ios-preview.yml` run, and (b) Apple
Developer Program credentials are supplied (see 0003). The web demo half of Phase 0's exit criteria
does not depend on this and is verified locally (screenshotted and click-tested with Playwright).

---

## 0003 — Apple Developer Program credentials pending

**Context:** §17.4 requires `APPSTORE_API_KEY_ID`, `APPSTORE_API_ISSUER_ID`, `APPSTORE_API_KEY_P8`, and
signing credentials (fastlane match or manual certs/profiles) as GitHub Actions secrets to sign and
upload to TestFlight.

**Decision:** The user confirmed they have a paid Apple Developer account and will provide the API key
and certificates when the `ios-preview.yml` / `release.yml` workflows are actually wired up (Phase 0
late task / Phase 6). Until supplied, CI iOS jobs build **unsigned** simulator artifacts only, per
§17.4's own fallback.

**Consequences:** No secrets are requested or stored until this step is reached. Revisit this entry
once credentials are provided and record the bundle id actually registered in App Store Connect.

---

## 0004 — GitHub repository creation deferred pending `gh auth login`

**Context:** `gh` was not authenticated. Interactive browser-based device login cannot be completed by
the agent.

**Decision:** The user was asked to run `gh auth login` themselves. Local git history and all Phase 0
files are being built in the meantime; `gh repo create` and the push (§17.1) happen as soon as
authentication is confirmed.

**Consequences:** None yet — this is a sequencing note, updated once the repo exists (record the repo
URL here).
