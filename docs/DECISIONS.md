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

**Follow-up:** Xcode is now installed and `apps/mobile/ios` has been generated — see 0006.

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
- `demo.yml` needed a different static host than GitHub Pages. **Asked the user**, who chose to make
  the repo public — free Pages, zero new accounts, and there was nothing sensitive in it anyway.

**Resolution:** Repo is now public (`gh repo edit --visibility public`). This unlocked two things at
once:
- `POST /repos/{owner}/{repo}/pages` succeeded — Pages is enabled (source: GitHub Actions, branch
  `develop`). Live demo: **https://lyemuk.github.io/photovault/**.
- Branch protection (0004) also now works on the free plan for a public repo — applied to both
  `main` and `develop`: PR required, required status checks (the `ci.yml`/`demo.yml`/
  `main-branch-guard.yml` job names), up to date before merge, linear history, no force-push, no
  deletion, conversations resolved, **enforce_admins: true**. That last one matters: from this point
  on, direct pushes to `main`/`develop` are rejected by GitHub itself, not just by discipline —
  including for the repo owner. All further work goes through `feature/*`/`fix/*` branches and PRs.

## 0004 — GitHub repository created

**Context:** `gh` was not authenticated at first; the user ran `gh auth login` themselves (as
account `LyeMuk`), since the agent cannot complete an interactive browser-based device login.

**Decision:** Once authenticated, created the repo per §17.1: `https://github.com/LyeMuk/photovault`
(private), pushed `main` and `develop`, set `develop` as the default branch with squash-merge-only
settings, and added `main-branch-guard.yml` (§17.2's "only release/*/hotfix/* may target main" rule).

**Consequences:** See 0005 for the branch-protection and Pages plan limitations discovered right
after this.

---

## 0006 — Xcode installed; apps/mobile/ios generated and building

**Context:** The user installed Xcode (full, not just Command Line Tools) via the App Store and
confirmed. `xcode-select -p` now points at `/Applications/Xcode.app/Contents/Developer`, and
`xcrun simctl list devices` works, confirming the license was already accepted.

**Decision:** Generated the Capacitor iOS project per issue #7 and apps/mobile/README.md:
- Capacitor's CLI needs its own `package.json` in its working directory (it doesn't walk up to a
  workspace root like plain Node resolution does) — added `apps/mobile/package.json` and added
  `apps/mobile` to the root `workspaces` array so its dependencies hoist to the shared root
  `node_modules` instead of needing a separate install.
- Bundle id: `com.lyemuk.photovault` (docs/CONTEXT.md §18's default pattern, `com.<owner>.photovault`).
- `xcodebuild -project ios/App/App.xcodeproj -scheme App -destination 'generic/platform=iOS Simulator'
  build` succeeds. Booted a simulator, installed, and launched the app — it renders the same shell UI
  as the browser build (top bar, demo banner, Home screen, bottom tabs), but every plugin call
  (`PhotoLibrary`/`Drive`/`Engine`/`Faces`/`Places`) fails on-device since no native Swift plugin
  exists yet (`native/CapacitorPlugins` is still empty), so the UI shows its empty states instead of
  demo data. **This is the expected Phase 0 native state**, not a bug — the spec's own Phase 0 demo
  milestone is "dashboard empty states," and full synthetic demo data was always meant to be a
  browser-only thing (docs/CONTEXT.md §17.5's web demo), not something the native shell reproduces
  before real plugins exist.
- Wired `xcodebuild` into `ci.yml`'s `native` job (build web assets → `cap copy ios` → `xcodebuild`
  for the simulator), matching §17.4's CI table. XCUITest itself is deferred to Phase 1, once there's
  a real device flow worth testing.
- `.gitignore` already correctly excluded the generated build cruft (`DerivedData`, `xcuserdata`,
  `App/App/public`) without changes — only source files (`capacitor.config.ts`, the Xcode project,
  `Package.resolved` for the SPM-based Capacitor dependency) get committed.

**Debugging note (a real dead end, recorded so it isn't repeated):** The first couple of manual
simulator launches showed a persistent blank white screen with no console errors. Spent significant
effort adding diagnostic scripts (error overlays, `console.error` capture) directly into the *built*
`DerivedData` copy of `index.html` to chase it — which led to a **self-inflicted false lead**: editing
that build product directly made it newer than the source `ios/App/App/public/index.html`, so Xcode's
incremental "copy bundle resources" phase kept skipping the re-copy on subsequent `xcodebuild` runs,
making the diagnostic patch appear to "fix" the blank screen when it was really just a stale-artifact
timing coincidence. A `xcodebuild clean` + rebuild proved the *unpatched* build also renders correctly
and consistently — the original blank screens were a cold-launch timing artifact (screenshotting
before the WKWebView finished its first paint), not a real bug. Lesson: never edit files under
`DerivedData` directly when debugging a build — it silently breaks incremental builds' freshness
checks. Always change the source and rebuild (or `xcodebuild clean` first if in doubt).

**Consequences:** Issue #7 is done. Phase 0's remaining gaps are just #9 (Apple Developer credentials,
for `ios-preview.yml` to actually sign and upload) — everything else about the native shell works.

---

## 0007 — Development stays local/simulator-only; Apple Developer Program deferred indefinitely

**Context:** The user can't afford the $99/year Apple Developer Program membership right now. Asked
what's actually blocked without it.

**Decision:** Almost nothing, for local development purposes:
- **Blocked, no workaround:** TestFlight distribution and App Store submission (issue #9's actual
  scope) — both hard-require a paid membership. `ios-preview.yml`/`release.yml` stay in their
  precondition-check-and-skip state (docs/DECISIONS.md 0003) indefinitely, not just temporarily.
- **Not blocked:** everything else. PhotoVault uses no capability that's paid-account-gated (no push
  notifications, iCloud/CloudKit, Apple Pay, etc.). Two free paths remain fully open:
  - **iOS Simulator** — no Apple ID needed at all, and critically, **the simulator has a real Photos
    library** backed by actual PhotoKit — seed it with test images via
    `xcrun simctl addmedia <device> <image-or-video-path>` and write genuine PHAsset-based Swift code
    against it. This covers real development and testing for Phase 1's permission flow, library sync,
    and thumbnails (issues #10–12) without any device or paid account.
  - **A free Apple ID + "Personal Team" signing**, for installing on the user's own physical iPhone via
    Xcode + USB when one becomes available — re-signs every 7 days instead of the paid program's 1
    year, but otherwise unrestricted for local use. Not set up yet (the user chose simulator-only for
    now); revisit issues #13/#14 (drive picking, vault init) then, since the simulator cannot do real
    external-drive/USB validation (`volumeIsRemovable` etc. behave differently with no real removable
    volume attached to a simulated device).

**Consequences:** Phase 0's literal exit criterion ("the TestFlight build installs") will not be met
until this is revisited — accepted as a known gap, not something to keep re-raising each phase.
Issues #10–12 proceed now against the simulator's real Photos library. Issues #13/#14 (real drive
validation) and any real-device fault-injection testing (docs/CONTEXT.md §14's device matrix) wait
for a physical iPhone.
