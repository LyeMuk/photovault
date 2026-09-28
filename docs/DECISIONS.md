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

## 0005 — Free-plan private-repo limits: no native branch protection, no GitHub Pages

**Context:** The repo (`LyeMuk/photovault`) is private on a free GitHub plan. Two things §17
anticipates as possible turned out to actually apply:
- `PUT /branches/{branch}/protection` returns 403 "Upgrade to GitHub Pro or make this repository
  public to enable this feature" for both `main` and `develop`.
- `POST /repos/{owner}/{repo}/pages` returns 422 "Your current plan does not support GitHub Pages
  for this repository."

**Decision:** Per §17.2's own fallback ("enforce the same rules with CI checks plus the agent's own
discipline") and §17.4/§17.5's own fallback ("use Vercel/Netlify"):
- Branch protection is enforced by discipline + the `ci.yml`/`main-branch-guard.yml` required checks
  only — nothing server-side stops a direct push to `main`/`develop`. Treat "never commit directly to
  main/develop" as a hard rule to follow manually until/unless the plan changes.
- `demo.yml` needs a different static host than GitHub Pages. **Asked the user** to choose one (see
  chat) rather than picking unilaterally, since it involves an account/credentials tradeoff:
  (a) make the repo public, which unlocks Pages for free with zero new accounts, or (b) keep it
  private and deploy to Vercel or Netlify, which needs that account plus a deploy token as a repo
  secret. Update this entry with whichever is chosen and the actual secret names once configured.

**Consequences:** Until the demo-hosting choice is made, `demo.yml`'s deploy step has no working
target — the `build` job (which needs no hosting decision) still runs and validates the demo build on
every push/PR.

## 0004 — GitHub repository created

**Context:** `gh` was not authenticated at first; the user ran `gh auth login` themselves (as
account `LyeMuk`), since the agent cannot complete an interactive browser-based device login.

**Decision:** Once authenticated, created the repo per §17.1: `https://github.com/LyeMuk/photovault`
(private), pushed `main` and `develop`, set `develop` as the default branch with squash-merge-only
settings, and added `main-branch-guard.yml` (§17.2's "only release/*/hotfix/* may target main" rule).

**Consequences:** See 0005 for the branch-protection and Pages plan limitations discovered right
after this.
